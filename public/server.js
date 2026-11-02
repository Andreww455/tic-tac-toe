const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const movies = require('./mockMovies');

const app = express(); //instance for the express
const server = http.createServer(app); //wrap app in http server
const io = new Server(server, { cors: { origin: '*' } }); //initialize socketio on top of server


app.use(express.static('public')); //anyone can access files located in public


app.get('/api/movies', (req, res) => {
  res.json(movies);
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);

  // 1. Create Room
  socket.on('createRoom', ({ roomCode, playerName }) => {
    rooms[roomCode] = {
      players: [{ id: socket.id, name: playerName, symbol: '🎬' }],
      turn: socket.id,
      board: Array(9).fill(null),
      usedMovieIds: []
    };
    socket.join(roomCode);
    console.log(`🏠 Room created: ${roomCode} by ${playerName}`);
    socket.emit('roomCreated', { roomCode, state: rooms[roomCode] });
  });

  // 2. Join Room
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit('errorMsg', 'Room not found!');
    if (room.players.length >= 2) return socket.emit('errorMsg', 'Room is full!');

    room.players.push({ id: socket.id, name: playerName, symbol: '🍿' });
    socket.join(roomCode);
    console.log(`👤 ${playerName} joined room: ${roomCode}`);

    io.to(roomCode).emit('gameStart', { roomCode, state: room });
  });

  // 3. Handle Move
  socket.on('submitMove', ({ roomCode, cellIndex, selectedMovieId }) => {
    const room = rooms[roomCode];
    if (!room || room.turn !== socket.id) return;

    const movie = movies.find(m => m.id === selectedMovieId);
    if (!movie || room.usedMovieIds.includes(movie.id)) {
      return socket.emit('errorMsg', 'Invalid or already played movie!');
    }

    room.usedMovieIds.push(movie.id);
    const player = room.players.find(p => p.id === socket.id);
    room.board[cellIndex] = { movieTitle: movie.title, playedBy: player.symbol };

    // Swap Turn
    const nextPlayer = room.players.find(p => p.id !== socket.id);
    room.turn = nextPlayer ? nextPlayer.id : socket.id;

    io.to(roomCode).emit('updateBoard', { board: room.board, nextTurn: room.turn });
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

server.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));