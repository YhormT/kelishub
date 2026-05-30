import { io } from 'socket.io-client';
import BASE_URL from '../endpoints/endpoints';

// Shared socket singleton - reused across all components to avoid duplicate connections
let socket = null;

export const getSocket = () => {
  if (!socket || socket.disconnected) {
    socket = io(BASE_URL, { transports: ['websocket', 'polling'] });

    // Auto-register userId on every connect/reconnect so the backend
    // can target this socket for suspension, balance updates, etc.
    socket.on('connect', () => {
      const userId = localStorage.getItem('userId');
      if (userId) {
        socket.emit('register', userId);
      }
    });
  }
  return socket;
};

export default getSocket;
