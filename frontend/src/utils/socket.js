import { io } from 'socket.io-client';

let socket = null;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const connectSocket = ({ role, userId, doctorId }) => {
  const s = getSocket();

  if(!s.connected) {
    s.connect();
    s.on('connect', () => {
      s.emit('join_room', { role, userId, doctorId });
    });

    s.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
  } else {
    s.emit('join_room', { role, userId, doctorId });
  }

  return s;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};