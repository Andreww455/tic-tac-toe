// client/src/App.jsx
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import movies from "./movies.json";
import categories from "./categories.json";
import "./index.css";

const socket = io();
const symbols = ["🎬", "🍿"];

// ── Win detection ──────────────────────────────────────────
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6]           // diagonals
];

function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[b] && board[c] &&
        board[a].symbol === board[b].symbol &&
        board[a].symbol === board[c].symbol) {
      return board[a].symbol;
    }
  }
  if (board.every(cell => cell)) return "draw";
  return null;
}

// ── Movie validity ─────────────────────────────────────────
// A movie is valid for a cell if it satisfies BOTH the row category and the col category.
// row/col have { type: "actor"|"genre", value: "karim"|"comedy"|... }
function isMovieValidForCell(movie, row, col) {
  const matchRow = row.type === "actor"
    ? movie.actors.includes(row.value)
    : movie.genres.includes(row.value);
  const matchCol = col.type === "actor"
    ? movie.actors.includes(col.value)
    : movie.genres.includes(col.value);
  return matchRow && matchCol;
}

// ── App ───────────────────────────────────────────────────
export default function App() {
  const { rows, cols } = categories;

  // ── Mode: "pass" | "online" | null ────────────────────
  const [mode, setMode] = useState(null);

  // ── Shared game state ──────────────────────────────────
  const [board, setBoard]           = useState(Array(9).fill(null));
  const [usedMovies, setUsedMovies] = useState(new Set());
  const [winner, setWinner]         = useState(null);
  const [localTurn, setLocalTurn]   = useState(0);

  // ── Online state ───────────────────────────────────────
  const [myId, setMyId]               = useState(null);
  const [roomCode, setRoomCode]       = useState("");
  const [joined, setJoined]           = useState(false);
  const [playerIndex, setPlayerIndex] = useState(null);
  const [turnPlayerId, setTurnPlayerId] = useState(null);

  // ── UI state ───────────────────────────────────────────
  const [showRoomModal, setShowRoomModal]     = useState(false);
  const [joinCodeInput, setJoinCodeInput]     = useState("");
  const [showSearch, setShowSearch]           = useState({
    open: false, cellIndex: null, row: null, col: null
  });
  const [searchTerm, setSearchTerm]     = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // ── Socket events ──────────────────────────────────────
  useEffect(() => {
    socket.on("connect", () => setMyId(socket.id));
    socket.on("stateUpdate", (state) => {
      setBoard(state.board);
      setTurnPlayerId(state.turnPlayerId);
      const w = checkWinner(state.board);
      setWinner(w);
      const used = new Set();
      state.board.forEach(cell => { if (cell) used.add(cell.movie); });
      setUsedMovies(used);
    });
    return () => { socket.off("connect"); socket.off("stateUpdate"); };
  }, []);

  // ── Game helpers ───────────────────────────────────────
  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setUsedMovies(new Set());
    setWinner(null);
    setLocalTurn(0);
    setTurnPlayerId(null);
    if (mode === "online" && roomCode) socket.emit("resetGame", { roomCode });
  };

  const handleCreateRoom = () => {
    socket.emit("createRoom", ({ roomCode: code }) => {
      setRoomCode(code);
      setJoined(true);
      setPlayerIndex(0);
      setShowRoomModal(false);
    });
  };

  const handleJoinRoom = () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (code.length !== 4) { alert("الكود يجب أن يكون 4 أحرف"); return; }
    socket.emit("joinRoom", { roomCode: code }, (res) => {
      if (res.success) {
        setRoomCode(code); setJoined(true); setPlayerIndex(1); setShowRoomModal(false);
      } else { alert(res.message); }
    });
  };

  // Open the search modal for a specific cell (knows its row + col categories)
  const openSearch = (cellIdx) => {
    const rowCat = rows[Math.floor(cellIdx / 3)];
    const colCat = cols[cellIdx % 3];
    setShowSearch({ open: true, cellIndex: cellIdx, row: rowCat, col: colCat });
    setSearchTerm("");
    setSearchResults([]);
  };

  const closeSearch = () => setShowSearch({ open: false, cellIndex: null, row: null, col: null });

  // Filter movies: must contain search term, be unused, AND fit BOTH categories
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (!term) { setSearchResults([]); return; }
    const { row, col } = showSearch;
    const filtered = movies.filter(m =>
      m.title.includes(term) &&
      !usedMovies.has(m.title) &&
      isMovieValidForCell(m, row, col)
    ).slice(0, 10);
    setSearchResults(filtered);
  };

  const selectMovie = (movie) => {
    const cellIdx = showSearch.cellIndex;
    if (mode === "pass") {
      const sym = symbols[localTurn % 2];
      const newBoard = [...board];
      newBoard[cellIdx] = { symbol: sym, movie: movie.title };
      setBoard(newBoard);
      setUsedMovies(prev => new Set(prev).add(movie.title));
      setLocalTurn(prev => prev + 1);
      const result = checkWinner(newBoard);
      if (result) setWinner(result);
    } else {
      socket.emit("makeMove", { roomCode, cellIndex: cellIdx, movie: movie.title }, (res) => {
        if (!res.success) alert(res.message);
      });
    }
    closeSearch();
  };

  // ── Derived UI ─────────────────────────────────────────
  const isMyTurn = mode === "pass" || (mode === "online" && turnPlayerId === myId);
  const currentSymbol = mode === "pass"
    ? symbols[localTurn % 2]
    : (playerIndex !== null ? symbols[playerIndex] : "?");

  const turnLabel = winner ? null
    : mode === "pass"
      ? `دور اللاعب ${localTurn % 2 === 0 ? "1" : "2"} ${symbols[localTurn % 2]}`
      : isMyTurn ? `دورك ${currentSymbol}` : "دور الخصم... ⏳";

  // ── Render: Menu ───────────────────────────────────────
  if (!mode) {
    return (
      <div className="menu">
        <span className="deco deco-tl">✦</span>
        <span className="deco deco-tr">💡</span>
        <span className="deco deco-bl">⚡</span>
        <span className="deco deco-br">❗</span>

        <h1 className="menu-title">🎬 Egyptian Cinema<br/>Tic‑Tac‑Toe 🍿</h1>
        <p className="menu-subtitle">اختر الفيلم الصح لكل خانة!</p>

        <div className="menu-buttons">
          <button id="btn-pass-play" className="btn"
            onClick={() => { setMode("pass"); resetGame(); }}>
            🎮 Pass &amp; Play (محلي)
          </button>
          <button id="btn-online" className="btn blue"
            onClick={() => { setMode("online"); setShowRoomModal(true); }}>
            🌐 Online Multiplayer
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Game ───────────────────────────────────────
  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <span className="header-title">🎬 Egyptian Tic‑Tac‑Toe</span>
        {mode === "online" && joined && (
          <span className="room-badge">🔑 {roomCode}</span>
        )}
        <button id="btn-reset" className="btn reset" onClick={resetGame}>↺ Reset</button>
      </header>

      {/* ── Turn bar ── */}
      {turnLabel && <div className="turn-bar">{turnLabel}</div>}

      {/* ── Category Grid (4×4: corner + 3 col headers + 3 row headers + 9 cells) ── */}
      <main className="cat-grid">

        {/* Corner (top-left empty cell) */}
        <div className="cat-corner">🎬</div>

        {/* Column category headers (top row) */}
        {cols.map(col => (
          <div key={col.id} className="cat-header">
            <span className="cat-emoji">{col.emoji}</span>
            <span className="cat-label">{col.label}</span>
            <span className="cat-desc">{col.description}</span>
          </div>
        ))}

        {/* Rows: each row has a row-header + 3 game cells */}
        {rows.map((row, rowIdx) => (
          <React.Fragment key={row.id}>
            {/* Row category header (left column) */}
            <div className="cat-header row-h">
              <span className="cat-emoji">{row.emoji}</span>
              <span className="cat-label">{row.label}</span>
              <span className="cat-desc">{row.description}</span>
            </div>

            {/* 3 game cells for this row */}
            {[0, 1, 2].map(colIdx => {
              const cellIdx = rowIdx * 3 + colIdx;
              const cell = board[cellIdx];
              const taken = !!cell;
              const clickable = !taken && !winner &&
                (mode === "pass" || (mode === "online" && joined && isMyTurn));

              return (
                <div
                  key={cellIdx}
                  id={`cell-${cellIdx}`}
                  className={`cell ${taken ? "taken" : ""} ${cell?.symbol === "🎬" ? "p1" : cell?.symbol === "🍿" ? "p2" : ""}`}
                  onClick={() => clickable && openSearch(cellIdx)}
                  style={{ cursor: clickable ? "pointer" : "default" }}
                  title={clickable ? `${row.label} × ${cols[colIdx].label}` : ""}
                >
                  {cell ? (
                    /* Claimed cell — show symbol + movie title */
                    <div className="cell-content">
                      <span className="cell-symbol">{cell.symbol}</span>
                      <span className="cell-title">{cell.movie}</span>
                    </div>
                  ) : (
                    /* Empty clickable cell — show a faint hint */
                    <span className="cell-hint">?</span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </main>

      {/* ── Win / Draw overlay ── */}
      {winner && (
        <div className="overlay">
          <div className="overlay-card">
            <div className={`overlay-title ${winner === "🍿" ? "blue" : winner === "draw" ? "pink" : ""}`}>
              {winner === "draw" ? "🤝 تعادل!" : `${winner === "🎬" ? "🎬 لاعب 1" : "🍿 لاعب 2"} يفوز! 🎉`}
            </div>
            <p className="overlay-sub">{winner === "draw" ? "لا أحد يفوز هذه المرة" : "باحتراف 💪"}</p>
            <button id="btn-play-again" className="btn pink" onClick={resetGame}>▶ العب مرة ثانية</button>
          </div>
        </div>
      )}

      {/* ── Room modal ── */}
      {showRoomModal && (
        <div className="backdrop" onClick={() => setShowRoomModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🌐 أنشئ أو انضم لغرفة</div>
            <div className="modal-actions">
              <button id="btn-create-room" className="btn" onClick={handleCreateRoom}>
                ✦ إنشاء غرفة جديدة
              </button>
              <div className="divider">أو</div>
              <div className="join-row">
                <input id="join-code-input" type="text" maxLength={4} placeholder="XXXX"
                  value={joinCodeInput}
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && handleJoinRoom()} />
                <button id="btn-join-room" className="btn blue" onClick={handleJoinRoom}>
                  انضم
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Movie search modal ── */}
      {showSearch.open && showSearch.row && showSearch.col && (
        <div className="backdrop" onClick={closeSearch}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            {/* Show the intersection requirement clearly */}
            <div className="modal-title">اختر فيلماً</div>
            <div className="cat-intersection-badge">
              <span className="ci-item">{showSearch.row.emoji} {showSearch.row.label}</span>
              <span className="ci-cross">×</span>
              <span className="ci-item">{showSearch.col.emoji} {showSearch.col.label}</span>
            </div>

            <input id="movie-search-input" type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="ابحث عن فيلم..."
              autoFocus />

            <ul className="results">
              {searchResults.map(m => (
                <li key={m.id} onClick={() => selectMovie(m)}>{m.title}</li>
              ))}
              {searchTerm && searchResults.length === 0 && (
                <li className="no-results">
                  لا يوجد فيلم مطابق لـ &quot;{showSearch.row.label} × {showSearch.col.label}&quot; 😕
                </li>
              )}
              {!searchTerm && (
                <li className="no-results">ابدأ الكتابة — يجب أن ينتمي الفيلم للتقاطع ⬆️</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
