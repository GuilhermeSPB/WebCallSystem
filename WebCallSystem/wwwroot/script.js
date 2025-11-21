const connection = new signalR.HubConnectionBuilder()
    .withUrl("/webcallHub")
    .build();

let local;
let localUser;
let peerConnections = {};
let secondUserId;
let pendingCandidates = {};

const servers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};


async function start() {

    try {
        if (connection.state != signalR.HubConnectionState.Connected) {
            await connection.start();
            localUser = connection.connectionId;
            var usuarios = await connection.invoke("Registrar");
            console.log("Usuários já conectados:", usuarios);
        } else {
            console.warn("Conexão já iniciada");
        }
    } catch (e) {
        console.log("Erro ao iniciar conexão SignalR: ", e);
    }
}


connection.on("UsuariosConectados", async (localUserId) => {

    try {
        const usuarios = await connection.invoke("ListarUsuarios");

        Object.keys(usuarios).forEach(async (item) => {

            if (item === localUser)
                return;

            if (!peerConnections[item]) {
                const ponto = createPeer(item);
                peerConnections[item] = ponto;

                criarVideoRemoto(item);

                const oferta = await ponto.createOffer();
                await ponto.setLocalDescription(oferta);

                await connection.invoke("EnviarOferta", item, JSON.stringify(oferta));
                console.log("Offer enviada para:", item);

            }
        });


    } catch (e) {
        console.log("Erro ao tentar criar ponto", e)
    }
});


connection.on("ReceberOferta", async (userId, offer) => {
    try {
        let ponto = peerConnections[userId] || createPeer(userId);

        criarVideoRemoto(userId);

        await ponto.setRemoteDescription(JSON.parse(offer));
        const answer = await ponto.createAnswer();
        await ponto.setLocalDescription(answer);

        if (pendingCandidates[userId]) {
            for (const c of pendingCandidates[userId]) {
                await ponto.addIceCandidate(c);
            }
            delete pendingCandidates[userId];
        }

        await connection.invoke("EnviarResposta", userId, JSON.stringify(answer));
        console.log("Resposta enviada para:", userId);

    } catch (err) {
        console.error("Erro ao processar oferta de:", userId, err);
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
        await ponto.addIceCandidate(candidate);
        console.log("ICE Candidate adicionado para:", userId);
    } catch (err) {
        console.error("Erro ao adicionar ICE Candidate para " + userId + " | " + err);
    }
});

connection.on("UsuarioSaiu", async (userId) => {
    $(`#remoteContainer-${userId}`).remove();
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

        await start(); // inicia a conexão SignalR
        await connection.invoke("InciarCall"); // notifica o servidor que entrou
    } catch (e) {
        console.error("Erro ao acessar câmera/microfone:", e);
    }
    
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
        <div id="remoteContainer-${userId}" style="text-align: center;" <div class="col-xs-12 col-sm-4 text-center">
            <h3>${userId}</h3>
            <video id="remoteVideo-${userId}" autoplay playsinline muted style="width: 320px; height: 240px; border-radius: 12px; background: #000;">
            </video>
        </div>
    `);

    $('#videoContainer').append($div);
}

$(document).ready(function () {
    modalShow();
});
