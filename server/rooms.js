// server/rooms.js
/**
 * Simple in‑memory room store for Tic‑Tac‑Toe.
 * Each room tracks two players (socket ids), the board state (array of 9 cells),
 * usedMovies (Set) and whose turn it is.
 */

const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (rooms[code]) return generateCode();
  return code;
}

function createRoom(creatorId) {
  const roomCode = generateCode();
  rooms[roomCode] = {
    players: [creatorId],
    board: Array(9).fill(null), // each cell: { symbol: '🎬'|'🍿', movie: string } or null
    usedMovies: new Set(),
    turnIndex: 0, // index in players array
    winner: null,
    draw: false
  };
  return roomCode;
}

function joinRoom(roomCode, playerId) {
  const room = rooms[roomCode];
  if (!room) return { success: false, message: 'Room not found' };
  if (room.players.length >= 2) return { success: false, message: 'Room full' };
  if (room.players.includes(playerId)) return { success: false, message: 'Already in room' };
  room.players.push(playerId);
  return { success: true, symbol: room.players.length === 1 ? '🎬' : '🍿' };
}

function makeMove(roomCode, playerId, cellIndex, movie) {
  const room = rooms[roomCode];
  if (!room) return { success: false, message: 'Room not found' };
  if (room.winner || room.draw) return { success: false, message: 'Game already finished' };
  if (!room.players.includes(playerId)) return { success: false, message: 'Not a player in this room' };
  if (room.players[room.turnIndex] !== playerId) return { success: false, message: "Not your turn" };
  if (room.board[cellIndex]) return { success: false, message: 'Cell already claimed' };
  if (room.usedMovies.has(movie)) return { success: false, message: 'Movie already used' };

  const symbol = room.players[0] === playerId ? '🎬' : '🍿';
  room.board[cellIndex] = { symbol, movie };
  room.usedMovies.add(movie);

  // Check win
  const lines = [
    [0,1,2],[3,4,5],[6,7,8], // rows
    [0,3,6],[1,4,7],[2,5,8], // cols
    [0,4,8],[2,4,6] // diags
  ];
  for (const line of lines) {
    const [a,b,c] = line;
    if (room.board[a] && room.board[b] && room.board[c] &&
        room.board[a].symbol === room.board[b].symbol &&
        room.board[a].symbol === room.board[c].symbol) {
      room.winner = room.board[a].symbol;
      break;
    }
  }
  if (!room.winner && room.board.every(cell => cell)) {
    room.draw = true;
  }

  // Switch turn
  if (!room.winner && !room.draw) {
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
  }

  return { success: true };
}

function getRoomState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return null;
  return {
    board: room.board,
    turnPlayerId: room.players[room.turnIndex] || null,
    winner: room.winner,
    draw: room.draw,
    players: room.players
  };
}

function resetRoom(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.board = Array(9).fill(null);
  room.usedMovies.clear();
  room.turnIndex = 0;
  room.winner = null;
  room.draw = false;
}

module.exports = { createRoom, joinRoom, makeMove, getRoomState, resetRoom };
