import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
    if (!socket) {
        socket = io('http://localhost:5000', {
            autoConnect: false,
        });
    }
    return socket;
};

export const connectSocket = ({ role, userId, doctorId }) => {
  const s = getSocket();

  if (!s.connected) {
    s.connect();

    s.on('connect', () => {
      
      s.emit('join_room', { role, userId, doctorId });
    });
  }

  return s;
};

// Disconnect socket
export const disconnectSocket = () => {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
    
  }
};