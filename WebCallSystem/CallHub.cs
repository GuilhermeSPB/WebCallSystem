using Microsoft.AspNetCore.SignalR;
using System.Collections.Generic;

namespace WebCallSystem
{
    public class CallHub : Hub
    {
        private static Dictionary<string, string> usuarioConectados = new Dictionary<string, string>();


        //Enviado do usuário que inicia a call para o outro usuário
        public async Task EnviarOferta(string objetoAlvo, string oferta)
        {
            await Clients.Client(objetoAlvo).SendAsync("ReceberRespostaOferta", Context.ConnectionId, oferta);
        }

        //Enviado do usuário que recebe a call para o usuário que iniciou a call
        public async Task EnviarResposta(string objetoAlvo, string resposta)
        {
            await Clients.Client(objetoAlvo).SendAsync("ReceberResposta", Context.ConnectionId, resposta);
        }

        // Tenta achar a melhor rota de comunicação para alcançar outro usuário.
        public async Task EnviarICE(string objetoAlvo, string candidato)
        {
            await Clients.Client(objetoAlvo).SendAsync("ReceberCandidato", Context.ConnectionId, candidato);
        }

        public async Task InciarCall()
        {
        var connectionId = Context.ConnectionId;
        
        usuarioConectados[connectionId] = connectionId;

            
            await Clients.Others.SendAsync("UsuarioEntrou", connectionId);

            
            var connectedUserList = usuarioConectados.Keys.Where(u => u != connectionId).ToList();
            await Clients.Caller.SendAsync("UsuariosConectados", connectionId);

        }

        public async Task <Dictionary<string,string>> Registrar()
        {
            usuarioConectados[Context.ConnectionId] = Context.ConnectionId;

            return usuarioConectados;
        }

        public void Remover()
        {
            var id = Context.ConnectionId;
            usuarioConectados.Remove(id);

        }

        public async Task<Dictionary<string, string>> ListarUsuarios()
        {
           return usuarioConectados;
        }

        public override async Task OnDisconnectedAsync(Exception? ex)
        {

            await Clients.Others.SendAsync("UsuarioSaiu", Context.ConnectionId);
            Remover();
            await base.OnDisconnectedAsync(ex);
        }
    }
}
