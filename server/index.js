// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createRoom, joinRoom, makeMove, getRoomState, resetRoom } = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Serve static files from client build (or dev client folder)
app.use(express.static(path.join(__dirname, '..', 'client')));

io.on('connection', (socket) => {
  console.log('New socket:', socket.id);

  socket.on('createRoom', (callback) => {
    const roomCode = createRoom(socket.id);
    socket.join(roomCode);
    callback({ roomCode });
  });

  socket.on('joinRoom', ({ roomCode }, callback) => {
    const result = joinRoom(roomCode, socket.id);
    if (result.success) {
      socket.join(roomCode);
      // Notify existing player of new opponent
      socket.to(roomCode).emit('playerJoined', { playerId: socket.id });
    }
    callback(result);
  });

  socket.on('makeMove', ({ roomCode, cellIndex, movie }, ack) => {
    const result = makeMove(roomCode, socket.id, cellIndex, movie);
    if (result.success) {
      io.in(roomCode).emit('stateUpdate', getRoomState(roomCode));
    }
    ack(result);
  });

  socket.on('resetGame', ({ roomCode }) => {
    resetRoom(roomCode);
    io.in(roomCode).emit('stateUpdate', getRoomState(roomCode));
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    // Optional: handle cleanup of rooms if needed
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
