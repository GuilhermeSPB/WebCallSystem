const connection = new signalR.HubConnectionBuilder()
    .withUrl("/webcallHub")
    .build();

let localStream;
let peerConnections = {};
let secondUserId;

// Configuração dos servidores STUN (para descoberta de IPs públicos)
const servers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};

// Inicia a conexão com o Hub
async function start() {
    if (connection.state === signalR.HubConnectionState.Disconnected) {
        await connection.start();
        console.log("Conexão Bem-Sucedida");
    } else {
        console.warn("Conexão já está inciada");
    }
}

// Quando um usuário entra
connection.on("UserJoined", async (userId) => {
    console.log("Usuário Entrou: ", userId);

    try {
        if (peerConnections[userId]) {
            console.warn("User joined - Ponto já existe para:", userId);
            return;
        }

        var ponto = criarPonto(userId); // Cria o ponto (PeerConnection) associado ao userId

        const offer = await ponto.createOffer(); // cria oferta (descrição geral de funcionamento do ponto)
        await ponto.setLocalDescription(offer); // define a descrição local do ponto

        await connection.invoke("SendOffer", userId, JSON.stringify(offer)); // envia oferta em forma de JSON para o outro usuário
        console.log("Oferta enviada para:", userId);

    } catch (err) {
        console.error("Erro ao tentar criar ponto do userId: " + userId + " ou enviar oferta | " + err);
    }
});

// recebe oferta
connection.on("ReceiveOffer", async (userId, offer) => {

    try {
        if (peerConnections[userId]) {
            console.warn("Receber Offer - Ponto já existe para:", userId);
            return;
        }

        var ponto = criarPonto(userId); // Cria ponto para este userId

        await ponto.setRemoteDescription(JSON.parse(offer)); // define a descrição recebida do outro ponto como remota
        const anwser = await ponto.createAnswer(); // cria a resposta
        await ponto.setLocalDescription(anwser); // define a descrição local da resposta

        await connection.invoke("SendAnswer", userId, JSON.stringify(anwser)); // envia a resposta para o outro usuário
        console.log("Resposta enviada para:", userId);

    } catch (err) {
        console.error("Erro ao tentar criar ponto do userId: " + userId + " ou enviar resposta | " + err);
    }
});

// recebe a resposta (answer)
connection.on("ReceiveAnswer", async (userId, answer) => {

    const ponto = peerConnections[userId];

    if (!ponto) {
        return console.error("Receber Answer - Ponto não encontrado para:", userId);
    }

    await ponto.setRemoteDescription(JSON.parse(answer)); // define a descrição recebida do outro ponto como remota
    console.log("Resposta recebida de: ", userId);
});

// recebe os candidatos ICE (endereços de rede)
connection.on("ReceiveIceCandidate", async (userId, candidateJson) => {
    const ponto = peerConnections[userId];
    if (!ponto) {
        console.error("Receber Ice - Ponto não encontrado para:", userId);
        return;
    }
    try {
        const candidate = new RTCIceCandidate(JSON.parse(candidateJson));
        await ponto.addIceCandidate(candidate);
        console.log("ICE Candidate adicionado para:", userId);
    } catch (err) {
        console.error("Erro ao adicionar ICE Candidate para " + userId + " | " + err);
    }
});

// Cria um peer (ponto de conexão WebRTC)
function createPeer(userId) {
    const ponto = new RTCPeerConnection(servers);

    // Quando o navegador descobre um novo candidato ICE
    ponto.onicecandidate = event => {
        if (event.candidate) {
            connection.invoke("SendIceCandidate", userId, JSON.stringify(event.candidate));
        }
    };

    // Quando recebe a stream de vídeo do outro usuário
    ponto.ontrack = event => {
        const remoteVideo = document.getElementById("remoteVideo");
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            console.log("Recebida stream remota de:", userId);
        }
    };

    // Adiciona as faixas locais (áudio/vídeo) ao ponto
    localStream.getTracks().forEach(track => ponto.addTrack(track, localStream));

    return ponto;
}

// Cria e registra o ponto (peer) no dicionário
function criarPonto(userId) {
    const ponto = createPeer(userId); // criar o ponto
    peerConnections[userId] = ponto; // Registra ponto na array
    return ponto;
}

// Evento de clique para entrar na chamada
document.getElementById("joinBtn").addEventListener("click", async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = localStream;

    await start(); // inicia a conexão SignalR
    await connection.invoke("JoinCall"); // notifica o servidor que entrou
});
