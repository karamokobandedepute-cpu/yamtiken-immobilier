import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // En production, restreindre aux origines autorisées (ex: VPS_FRONTEND_ORIGIN)
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Nouvelle connexion WebSockets: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`🔌 Déconnexion WebSockets: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io n\'est pas initialisé!');
  }
  return io;
};
