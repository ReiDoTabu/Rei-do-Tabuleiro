import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

/* =========================
   FIREBASE
========================= */

const firebaseConfig = {
  apiKey: "AIzaSyBuz-kqBL6zEQfGWJpKHdm7y73ki8EBpx0",
  authDomain: "rei-do-tabuleiro.firebaseapp.com",
  projectId: "rei-do-tabuleiro",
  storageBucket: "rei-do-tabuleiro.firebasestorage.app",
  messagingSenderId: "855172254287",
  appId: "1:855172254287:web:b5c3f56d4e0cc06630f83a",
  databaseURL: "https://rei-do-tabuleiro-default-rtdb.europe-west1.firebasedatabase.app"
  
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* =========================
   PLAYER SLOT
========================= */

let myPlayer = null;

const playerRef = ref(db, "players");

onValue(playerRef, (snap) => {

  if (myPlayer) return;

  const players = snap.val() || {};

  if (!players.red) {

    myPlayer = "red";
    const myRef = ref(db, "players/red");
    set(myRef, true);
    onDisconnect(myRef).remove();

  } else if (!players.black) {

    myPlayer = "black";
    const myRef = ref(db, "players/black");
    set(myRef, true);
    onDisconnect(myRef).remove();

  } else {

    myPlayer = "spectator";

  }

  updateTurnText();
});

/* =========================
   ELEMENTOS
========================= */

const boardEl = document.getElementById("board");
const timerRedEl = document.getElementById("timer-red");     // Azul
const timerBlackEl = document.getElementById("timer-black"); // Branco
const turnText = document.getElementById("turnText");
const countdownEl = document.getElementById("countdown");

const victoryScreen = document.getElementById("victoryScreen");
const victoryTitle = document.getElementById("victoryTitle");
const victoryReason = document.getElementById("victoryReason");
const restartBtn = document.getElementById("restartBtn");

/* =========================
   ESTADO
========================= */

let board = [];
let currentPlayer = "red";

let selected = null;
let mustCaptureGlobal = false;
let comboActive = false;
let mandatorySequences = null;

let timeRed = 180;     // Azul
let timeBlack = 180;   // Branco
let timerInterval = null;
let gameStarted = false;

/* =========================
   START
========================= */

restartBtn.addEventListener("click", () => {
  if (myPlayer === "red") {
    startNewGameAndSave();
  }
});

function startNewGameAndSave() {
  startGame();
  saveGameState();
}

/* =========================
   INICIAR JOGO LOCAL
========================= */

function startGame() {

  victoryScreen.classList.add("hidden");

  board = [];
  boardEl.innerHTML = "";
  selected = null;
  comboActive = false;
  mandatorySequences = null;
  currentPlayer = "red";

  timeRed = 180;
  timeBlack = 180;
  updateTimers();

  gameStarted = false;
  countdownEl.style.display = "flex";

  buildInitialBoard();
  startCountdown();

  updateMandatorySequences();
  highlightPlayablePieces();
}

/* =========================
   TABULEIRO INICIAL
========================= */

function buildInitialBoard() {

  board = [];

  for (let r = 0; r < 8; r++) {

    const row = [];

    for (let c = 0; c < 8; c++) {

      const sq = document.createElement("div");
      sq.className = "square";
      sq.dataset.row = r;
      sq.dataset.col = c;

      if ((r + c) % 2 === 1) {

        sq.classList.add("dark");
        sq.onclick = onSquareClick;

        let piece = null;

        if (r < 3) piece = { color: "black", king: false };
        if (r > 4) piece = { color: "red", king: false };

        if (piece) {
          const el = document.createElement("div");
          el.className = `piece ${piece.color}`;
          sq.appendChild(el);
          piece.el = el;
        }

        row.push(piece);

      } else {

        sq.classList.add("light");
        row.push(null);

      }

      boardEl.appendChild(sq);
    }

    board.push(row);
  }
}

/* =========================
   CONTAGEM
========================= */

function startCountdown() {

  let count = 5;
  countdownEl.textContent = count;

  const cd = setInterval(() => {

    count--;
    countdownEl.textContent = count;

    if (count === 0) {

      clearInterval(cd);
      countdownEl.style.display = "none";
      gameStarted = true;
      updateTurnText();
      startTurnTimer();
      highlightPlayablePieces();

    }

  }, 1000);
}

/* =========================
   TIMER
========================= */

function startTurnTimer() {

  clearInterval(timerInterval);

  timerInterval = setInterval(() => {

    if (currentPlayer === "red") {

      timeRed--;
      if (timeRed <= 0) endGame("black", "tempo esgotado");

    } else {

      timeBlack--;
      if (timeBlack <= 0) endGame("red", "tempo esgotado");

    }

    updateTimers();

  }, 1000);
}

function updateTimers() {
  timerRedEl.textContent = formatTime(timeRed);
  timerBlackEl.textContent = formatTime(timeBlack);
}

function formatTime(t) {
  const m = String(Math.floor(t / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/* =========================
   FIM DE JOGO
========================= */

function endGame(winner, reason) {

  clearInterval(timerInterval);
  gameStarted = false;

  victoryTitle.textContent =
    winner === "red" ? "🔵 Azul venceu!" : "⚪ Branco venceu!";

  victoryReason.textContent = `Motivo: ${reason}`;
  victoryScreen.classList.remove("hidden");
}

/* =========================
   CLIQUE
========================= */

function onSquareClick(e) {

  if (!gameStarted) return;
  if (myPlayer !== currentPlayer) return;

  const sq = e.currentTarget;
  const r = +sq.dataset.row;
  const c = +sq.dataset.col;
  const piece = board[r][c];

  if (piece && piece.color === currentPlayer) {

    if (comboActive && (!selected || selected.r !== r || selected.c !== c))
      return;

    if (mandatorySequences && !mandatorySequences[`${r},${c}`])
      return;

    clearSelection();
    clearPlayableHighlights();

    selected = { r, c };
    piece.el.classList.add("selected");
    highlightMoves(r, c);
    return;
  }

  if (selected) {
    tryMove(selected.r, selected.c, r, c);
  }
}

/* =========================
   MOVIMENTO
========================= */

function tryMove(fr, fc, tr, tc) {

  const piece = board[fr][fc];
  if (!piece || board[tr][tc]) return;

  const moves = getLegalMoves(fr, fc);
  const move = moves.find(m => m.r === tr && m.c === tc);
  if (!move) return;

  movePiece(fr, fc, tr, tc);

  if (move.capture) {
    board[move.mr][move.mc] = null;
    getSq(move.mr, move.mc).innerHTML = "";
  }

  if (mandatorySequences && mandatorySequences[`${fr},${fc}`]) {

    let seqs = mandatorySequences[`${fr},${fc}`];

    seqs = seqs.filter(s =>
      s[0].tr === tr && s[0].tc === tc
    );

    seqs.forEach(s => s.shift());

    if (seqs[0].length > 0) {

      selected = { r: tr, c: tc };
      comboActive = true;

      mandatorySequences = {
        [`${tr},${tc}`]: seqs
      };

      clearHighlights();
      clearPlayableHighlights();
      highlightMoves(tr, tc);
      return;
    }
  }

  promoteIfNeeded(tr, piece);
  endTurn();
}

/* =========================
   TURNO
========================= */

function endTurn() {

  clearSelection();
  comboActive = false;
  currentPlayer = currentPlayer === "red" ? "black" : "red";

  updateMandatorySequences();
  updateTurnText();
  startTurnTimer();
  checkLossByNoMoves();
  highlightPlayablePieces();

  saveGameState();
}

/* =========================
   DERROTA
========================= */

function checkLossByNoMoves() {

  let hasPiece = false;
  let hasMove = false;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {

      const p = board[r][c];

      if (p && p.color === currentPlayer) {

        hasPiece = true;

        if (getLegalMoves(r, c).length > 0) {
          hasMove = true;
          break;
        }
      }
    }

    if (hasMove) break;
  }

  if (!hasPiece) {
    endGame(currentPlayer === "red" ? "black" : "red", "sem peças");
  } else if (!hasMove) {
    endGame(currentPlayer === "red" ? "black" : "red", "sem movimentos");
  }
}

/* =========================
   LEGAL MOVES
========================= */

function getLegalMoves(r, c) {

  const p = board[r][c];
  if (!p) return [];

  if (!mandatorySequences) {
    return getSimpleMoves(r, c);
  }

  const key = `${r},${c}`;
  const seqs = mandatorySequences[key];
  if (!seqs) return [];

  const res = [];
  const used = new Set();

  seqs.forEach(s => {

    const step = s[0];
    const k = step.tr + "," + step.tc;

    if (!used.has(k)) {

      used.add(k);

      res.push({
        r: step.tr,
        c: step.tc,
        capture: true,
        mr: step.mr,
        mc: step.mc
      });
    }
  });

  return res;
}

/* =========================
   SIMPLE
========================= */

function getSimpleMoves(r, c) {

  const p = board[r][c];
  const moves = [];
  const captures = [];
  const dirs = [-1, 1];

  if (p.king) {

    for (let dr of dirs) for (let dc of dirs) {

      let nr = r + dr;
      let nc = c + dc;
      let enemy = null;

      while (board[nr]?.[nc] !== undefined) {

        if (board[nr][nc] === null) {

          if (enemy) {
            captures.push({ r: nr, c: nc, capture: true, mr: enemy.r, mc: enemy.c });
          } else if (!mustCaptureGlobal) {
            moves.push({ r: nr, c: nc, capture: false });
          }

        } else {

          if (board[nr][nc].color === p.color) break;
          if (enemy) break;
          enemy = { r: nr, c: nc };
        }

        nr += dr;
        nc += dc;
      }
    }

    return captures.length ? captures : moves;
  }

  const dir = p.color === "red" ? -1 : 1;

  if (!mustCaptureGlobal) {

    for (let dc of dirs) {

      const nr = r + dir;
      const nc = c + dc;

      if (board[nr]?.[nc] === null)
        moves.push({ r: nr, c: nc, capture: false });
    }
  }

  for (let dr of dirs) for (let dc of dirs) {

    const mr = r + dr;
    const mc = c + dc;
    const tr = r + dr * 2;
    const tc = c + dc * 2;

    if (
      board[mr]?.[mc] &&
      board[mr][mc].color !== p.color &&
      board[tr]?.[tc] === null
    ) {
      captures.push({ r: tr, c: tc, capture: true, mr, mc });
    }
  }

  return captures.length ? captures : moves;
}

/* =========================
   MAIOR CAPTURA
========================= */

function updateMandatorySequences() {

  const all = [];

  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === currentPlayer) {

        const seqs = findAllCaptureSequences(r, c);
        seqs.forEach(s => all.push(s));
      }

  if (all.length === 0) {
    mandatorySequences = null;
    mustCaptureGlobal = false;
    return;
  }

  let max = Math.max(...all.map(s => s.steps.length));
  const best = all.filter(s => s.steps.length === max);

  mandatorySequences = {};

  best.forEach(s => {

    const key = `${s.fr},${s.fc}`;

    if (!mandatorySequences[key])
      mandatorySequences[key] = [];

    mandatorySequences[key].push(
      s.steps.map(x => ({ ...x }))
    );
  });

  mustCaptureGlobal = true;
}

/* =========================
   BUSCA
========================= */

function findAllCaptureSequences(r, c) {

  const p = board[r][c];
  if (!p) return [];

  const results = [];

  dfs(board, r, c, p, [], null);

  return results.map(s => ({
    fr: r,
    fc: c,
    steps: s
  }));

  function dfs(b, cr, cc, piece, path, lastDir) {

    const caps = getCapturesFrom(b, cr, cc, piece, lastDir);

    if (caps.length === 0) {

      if (path.length)
        results.push([...path]);

      return;
    }

    for (const m of caps) {

      const nb = cloneBoard(b);
      const p2 = nb[cr][cc];

      nb[cr][cc] = null;
      nb[m.tr][m.tc] = p2;
      nb[m.mr][m.mc] = null;

      let newLast = null;

      if (p2.king) {
        newLast = { dr: Math.sign(m.tr - cr), dc: Math.sign(m.tc - cc) };
      }

      dfs(nb, m.tr, m.tc, p2, [...path, m], newLast);
    }
  }
}

/* =========================
   CAPTURAS
========================= */

function getCapturesFrom(b, r, c, p, lastDir) {

  const res = [];
  const dirs = [-1, 1];

  if (p.king) {

    for (let dr of dirs) for (let dc of dirs) {

      if (lastDir && dr === -lastDir.dr && dc === -lastDir.dc)
        continue;

      let nr = r + dr;
      let nc = c + dc;
      let enemy = null;

      while (b[nr]?.[nc] !== undefined) {

        if (b[nr][nc] === null) {

          if (enemy) {
            res.push({ tr: nr, tc: nc, mr: enemy.r, mc: enemy.c });
          }

        } else {

          if (b[nr][nc].color === p.color) break;
          if (enemy) break;
          enemy = { r: nr, c: nc };
        }

        nr += dr;
        nc += dc;
      }
    }

    return res;
  }

  for (let dr of dirs) for (let dc of dirs) {

    const mr = r + dr;
    const mc = c + dc;
    const tr = r + dr * 2;
    const tc = c + dc * 2;

    if (
      b[mr]?.[mc] &&
      b[mr][mc].color !== p.color &&
      b[tr]?.[tc] === null
    ) {
      res.push({ tr, tc, mr, mc });
    }
  }

  return res;
}

/* =========================
   UTIL
========================= */

function highlightMoves(r, c) {
  clearHighlights();
  getLegalMoves(r, c).forEach(m => {
    getSq(m.r, m.c).classList.add("highlight");
  });
}

function movePiece(fr, fc, tr, tc) {
  board[tr][tc] = board[fr][fc];
  board[fr][fc] = null;
  getSq(tr, tc).appendChild(getSq(fr, fc).firstChild);
}

function promoteIfNeeded(r, piece) {

  if (
    !piece.king &&
    ((piece.color === "red" && r === 0) ||
     (piece.color === "black" && r === 7))
  ) {

    piece.king = true;
    piece.el.classList.add("king");
  }
}

function clearSelection() {
  document.querySelectorAll(".selected").forEach(p => p.classList.remove("selected"));
  clearHighlights();
  selected = null;
}

function clearHighlights() {
  document.querySelectorAll(".highlight").forEach(s => s.classList.remove("highlight"));
}

function clearPlayableHighlights() {
  document.querySelectorAll(".piece.can-play").forEach(p => p.classList.remove("can-play"));
}

function getSq(r, c) {
  return boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
}

function cloneBoard(b) {
  return b.map(row =>
    row.map(p => p ? { color: p.color, king: p.king } : null)
  );
}

/* =========================
   DESTAQUES
========================= */

function highlightPlayablePieces() {

  clearPlayableHighlights();

  if (!gameStarted) return;

  if (comboActive && selected) {

    const p = board[selected.r][selected.c];
    if (p && p.el) p.el.classList.add("can-play");
    return;
  }

  if (mandatorySequences) {

    for (const key in mandatorySequences) {

      const [r, c] = key.split(",").map(Number);
      const p = board[r][c];

      if (p && p.el) p.el.classList.add("can-play");
    }

    return;
  }

  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {

      const p = board[r][c];

      if (p && p.color === currentPlayer && getLegalMoves(r, c).length > 0) {
        p.el.classList.add("can-play");
      }
    }
}

/* =========================
   TEXTO
========================= */

function updateTurnText() {

  if (!turnText) return;

  if (myPlayer === "spectator") {
    turnText.textContent = "ESPECTADOR";
    return;
  }

  if (currentPlayer === myPlayer) {
    turnText.textContent = "SEU TURNO";
  } else {
    turnText.textContent = "AGUARDE";
  }
}

function applyPlayerNameColors() {

  const players = document.querySelectorAll(".player-box");

  players.forEach(box => {

    const name = box.querySelector(".name");
    if (!name) return;

    if (box.closest(".top-panel")) name.style.color = "#e6e6e6";
    if (box.closest(".bottom-panel")) name.style.color = "#3fa9ff";
  });
}

/* =========================
   SYNC
========================= */

window.addEventListener("load", () => {

  applyPlayerNameColors();

  const gameRef = ref(db, "games/public");

  onValue(gameRef, (snap) => {

    const data = snap.val();

    if (!data) {

      if (myPlayer === "red") {
        startNewGameAndSave();
      }

      return;
    }

    loadGameState(data);
  });
});

function serializeBoard() {

  return board.map(row =>
    row.map(p => p ? { color: p.color, king: p.king } : null)
  );
}

function saveGameState() {

  const data = {
    board: serializeBoard(),
    currentPlayer
  };

  set(ref(db, "games/public"), data);
}

function loadGameState(data) {

  if (!data || !data.board) return;

  board = data.board.map(row =>
    row.map(p => p ? { color: p.color, king: p.king } : null)
  );

  rebuildBoardFromState();
  currentPlayer = data.currentPlayer;
  updateMandatorySequences();
  updateTurnText();
  highlightPlayablePieces();
}

function rebuildBoardFromState() {

  boardEl.innerHTML = "";

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {

      const sq = document.createElement("div");
      sq.className = "square";
      sq.dataset.row = r;
      sq.dataset.col = c;

      if ((r + c) % 2 === 1) {

        sq.classList.add("dark");
        sq.onclick = onSquareClick;

        const piece = board[r][c];

        if (piece) {

          const el = document.createElement("div");
          el.className = `piece ${piece.color}`;
          if (piece.king) el.classList.add("king");

          sq.appendChild(el);
          piece.el = el;
        }

      } else {
        sq.classList.add("light");
      }

      boardEl.appendChild(sq);
    }
  }
}


