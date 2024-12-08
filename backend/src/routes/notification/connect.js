'use strict';

const { verifyToken, verifyJWT } = require('../../jwt');

module.exports = async function (fastify, opts) {
  fastify.route({
    url: '/ws',
    method: 'GET',
    websocket: true,
    handler: async (socket, request) => {
      const token = request.cookies.jwt;

      if (!token) {
        socket.send(JSON.stringify({
          type: 'ERROR',
          error: 'token missing, try again'
        }));
        console.log("token missing")
        socket.close();
        return;
      }

      try {
        const decodedPayload = verifyToken(token, 'your-secret-key');
        if (!decodedPayload) throw new Error('Invalid token');
        const username = decodedPayload.sub;
      
        fastify.userConnections.set(username, socket);
        socket.username = username;

      } catch (error) {
        socket.send(JSON.stringify({
          type: 'ERROR',
          error: 'Authentication failed, please re-authenticate'
        }));
        console.log("Authentication error:", error.message);
        socket.close();
      }      
        
      socket.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.type === 'PING') {
          socket.send(JSON.stringify({ type: 'PONG', message: 'Pong' }));
        }
        else {
          socket.send(JSON.stringify({ type: 'PONG', message: "what?"}))
        }
      });
    },
    onClose: (socket) => {
      const username = socket.username;
      fastify.userConnections.delete(username);
      console.log('Socket closed:', fastify.userConnections);
    }
  });
}

