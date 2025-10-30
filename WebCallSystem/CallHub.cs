using Microsoft.AspNetCore.SignalR;

namespace WebCallSystem
{
    public class CallHub : Hub
    {

        //Enviado do usuário que inicia a call para o outro usuário
        public async Task SendOffer(string targetId, string offer)
        {
            await Clients.Client(targetId).SendAsync("ReceiveOffer", Context.ConnectionId, offer);
        }

        //Enviado do usuário que recebe a call para o usuário que iniciou a call
        public async Task SendAnswer(string targetId, string answer)
        {
            await Clients.Client(targetId).SendAsync("ReceiveAnswer", Context.ConnectionId, answer);
        }

        // Tenta achar a melhor rota de comunicação para alcançar outro usuário.
        public async Task SendIceCandidate(string targetId, string candidate)
        {
            await Clients.Client(targetId).SendAsync("ReceiveIceCandidate", Context.ConnectionId, candidate);
        }

        public async Task JoinCall()
        {
            await Clients.Others.SendAsync("UserJoined", Context.ConnectionId);
        }

        public override async Task OnDisconnectedAsync(Exception? ex)
        {
            await Clients.Others.SendAsync("UserLeft", Context.ConnectionId);
            await base.OnDisconnectedAsync(ex);
        }
    }
}
