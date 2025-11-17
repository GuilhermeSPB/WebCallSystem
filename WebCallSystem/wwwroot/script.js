const connection = new signalR.HubConnectionBuilder()
    .withUrl("/webcallHub")
    .build();

let local;
let localUser;
let peerConnections = {};
let secondUserId;


const servers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};


async function start() {

    try {
        if (connection.state != signalR.HubConnectionState.Connected) {
            await connection.start();
            var usuarios = await connection.invoke("Registrar");
            console.log("Usuários já conectados:", usuarios);
        } else {
            console.warn("Conexão já iniciada");
        }
    } catch (e) {
        console.log("Erro ao iniciar conexão SignalR: ", e);
    }
}


connection.on("UsuariosConectados", async (userId) => {
    localUser = userId;
    try {
        usuarios = await connection.invoke("ListarUsuarios")
        for (var item in usuarios) {

            // Cria uma conexão P2P para cada usuário já conectado

            var ponto = createPeer(item);


            // Adiciona o vídeo remoto (para exibir quando o stream chegar)
            if (item != localUser) {
                criarVideoRemoto(item);
                console.warn("criando caixa de usuário para o usuário: ");

                // Cria a oferta (offer) para iniciar a conexão
                const oferta = await ponto.createOffer();
                await ponto.setLocalDescription(oferta);

                // Envia a offer para o outro usuário via SignalR
                await connection.invoke("EnviarOferta", item, JSON.stringify(oferta));
                console.log("Offer enviada para:", item);
            }
        }

    } catch (e) {
        console.log("Erro ao tentar criar ponto", e)
    }
});


connection.on("ReceberOferta", async (userId, offer) => {

    try {
        var ponto = createPeer(userId);
        await ponto.setRemoteDescription(JSON.parse(offer)); // define a descrição recebida do outro ponto como remota
        const anwser = await ponto.createAnswer(); // cria a resposta
        await ponto.setLocalDescription(anwser); // define a descrição local da resposta


        //if (pendingCandidates[userId]) {
        //    for (const c of pendingCandidates[userId]) {
        //        try {
        //            await ponto.addIceCandidate(c);
        //        } catch (e) { console.log("Erro ao tentar adiciona candidato ICE: ", e) }
        //    }
        //    delete pendingCandidates[userId];
        //}

        await connection.invoke("EnviarResposta", userId, JSON.stringify(anwser));
        console.log("Resposta enviada para:", userId);

    } catch (err) {
        console.error("Erro ao tentar criar ponto do userId: " + userId + " ou enviar resposta | " + err);
    }
});

// recebe a resposta (answer)
connection.on("ReceberResposta", async (userId, answer) => {

    const ponto = peerConnections[userId];

    if (!ponto) {
        return console.error("Receber Answer - Ponto não encontrado para:", userId);
    }

    await ponto.setRemoteDescription(JSON.parse(answer)); // define a descrição recebida do outro ponto como remota
    console.log("Resposta recebida de: ", userId);
});

// recebe os candidatos ICE (endereços de rede)

let pendingCandidates = {};

connection.on("ReceberICE", async (userId, candidateJson) => {
    const ponto = peerConnections[userId];
    const candidate = new RTCIceCandidate(JSON.parse(candidateJson));

    if (!ponto || !ponto.remoteDescription) {
        // Guarda temporariamente
        if (!pendingCandidates[userId]) pendingCandidates[userId] = [];
        pendingCandidates[userId].push(candidate);
        return;
    }

    try {
        criarVideoRemoto(userId);
        await ponto.addIceCandidate(candidate);
        console.log("ICE Candidate adicionado para:", userId);
    } catch (err) {
        console.error("Erro ao adicionar ICE Candidate para " + userId + " | " + err);
    }
});

// Cria um peer (ponto de conexão WebRTC)
function createPeer(userId) {
    if (!peerConnections[userId]) {
        var ponto = new RTCPeerConnection(servers);

        // Quando o navegador descobre um novo candidato ICE
        ponto.onicecandidate = event => {
            if (event.candidate) {
                connection.invoke("EnviarICE", userId, JSON.stringify(event.candidate));
            }
        };

        // Quando recebe a stream de vídeo do outro usuário
        ponto.ontrack = event => {
            const $remoteVideo = $(`#remoteVideo-${userId}`);
            if ($remoteVideo.prop('srcObject') !== event.streams[0]) {
                $remoteVideo.prop('srcObject', event.streams[0]);
                console.log("Recebida stream remota de:", userId);
            }
        };

        // Adiciona as faixas locais (áudio/vídeo) ao ponto
        if (localStream) {
            localStream.getTracks().forEach(track => ponto.addTrack(track, localStream));
        } else {
            console.warn("localStream ainda não está definido ao criar peer de", userId);
        }
        peerConnections[userId] = ponto;
        return ponto;

    } else {
        var ponto = peerConnections[userId];
        return ponto;
    }

}



// Evento de clique para entrar na chamada
$('#joinBtn').click(async function () {

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById("localVideo").srcObject = localStream;
    } catch (e) {
        console.error("Erro ao acessar câmera/microfone:", e);
    }

    await start(); // inicia a conexão SignalR
    await connection.invoke("InciarCall"); // notifica o servidor que entrou
});


function modalShow() {
    let username = "";

    $('#usernameModal').modal('show');

    $('#confirmUsername').click(function () {
        const inputName = $('#modalUsername').val().trim();

        if (inputName) {
            username = inputName;
            $('#usernameModal').modal('hide');

            //connection.start()
            //    .then(function () {
            //        connection.invoke("RegisterUser", username);
            //    })
            //    .catch(function (err) {
            //        console.error(err.toString());
            //    });
            $("#userNameLabel").text(username);

        } else {
            alert("Por favor, insira um nome");
        }

    });
}


function criarVideoRemoto(userId) {
    // evita duplicatas
    if ($(`#remoteContainer-${userId}`).length) return;

    const $div = $(`
        <div id="remoteContainer-${userId}" style="text-align: center;">
            <h3>Usuário: ${userId}</h3>
            <video id="remoteVideo-${userId}" autoplay playsinline
                style="width: 320px; height: 240px; border-radius: 12px; background: #000;">
            </video>
        </div>
    `);

    $('#videoContainer').append($div);
}

$(document).ready(function () {
    modalShow();
});
