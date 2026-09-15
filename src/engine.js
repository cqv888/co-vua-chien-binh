// ===== Chess engine (rules) =====
const Chess = (() => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  function parse(fen) {
    const b = [];
    for (const row of fen.split('/')) {
      const r = [];
      for (const ch of row) {
        if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) r.push(null);
        else r.push((ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase());
      }
      b.push(r);
    }
    return b;
  }
  function initial() {
    return { board: parse(START), turn: 'w', castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: null, halfmove: 0, moves: [], captured: { w: [], b: [] } };
  }
  const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function attacked(board, r, c, by) {
    // pawns
    const pr = by === 'w' ? r + 1 : r - 1;
    for (const dc of [-1, 1]) if (inb(pr, c + dc) && board[pr][c + dc] === by + 'P') return true;
    for (const [dr, dc] of KN) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && board[rr][cc] === by + 'N') return true; }
    for (const [dr, dc] of KG) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && board[rr][cc] === by + 'K') return true; }
    for (const [dr, dc] of DIAG) { let rr = r + dr, cc = c + dc; while (inb(rr, cc)) { const p = board[rr][cc]; if (p) { if (p[0] === by && (p[1] === 'B' || p[1] === 'Q')) return true; break; } rr += dr; cc += dc; } }
    for (const [dr, dc] of ORTH) { let rr = r + dr, cc = c + dc; while (inb(rr, cc)) { const p = board[rr][cc]; if (p) { if (p[0] === by && (p[1] === 'R' || p[1] === 'Q')) return true; break; } rr += dr; cc += dc; } }
    return false;
  }
  function findKing(board, color) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] === color + 'K') return [r, c];
    return null;
  }
  function inCheck(state, color) {
    const k = findKing(state.board, color);
    return k ? attacked(state.board, k[0], k[1], color === 'w' ? 'b' : 'w') : false;
  }
  function pseudo(state, r, c) {
    const b = state.board, p = b[r][c]; if (!p) return [];
    const col = p[0], t = p[1], opp = col === 'w' ? 'b' : 'w', out = [];
    const add = (rr, cc, extra) => out.push(Object.assign({ from: [r, c], to: [rr, cc], piece: p, capture: b[rr][cc] }, extra));
    if (t === 'P') {
      const dir = col === 'w' ? -1 : 1, startRow = col === 'w' ? 6 : 1, last = col === 'w' ? 0 : 7;
      const r1 = r + dir;
      if (inb(r1, c) && !b[r1][c]) {
        add(r1, c, r1 === last ? { promo: 'Q' } : {});
        if (r === startRow && !b[r + 2 * dir][c]) add(r + 2 * dir, c, { double: true });
      }
      for (const dc of [-1, 1]) {
        const cc = c + dc; if (!inb(r1, cc)) continue;
        if (b[r1][cc] && b[r1][cc][0] === opp) add(r1, cc, r1 === last ? { promo: 'Q' } : {});
        else if (state.ep && state.ep[0] === r1 && state.ep[1] === cc) out.push({ from: [r, c], to: [r1, cc], piece: p, capture: opp + 'P', ep: true });
      }
    } else if (t === 'N' || t === 'K') {
      for (const [dr, dc] of (t === 'N' ? KN : KG)) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && (!b[rr][cc] || b[rr][cc][0] === opp)) add(rr, cc, {}); }
      if (t === 'K') {
        const home = col === 'w' ? 7 : 0;
        if (r === home && c === 4 && !attacked(b, r, 4, opp)) {
          if (state.castle[col + 'K'] && b[home][7] === col + 'R' && !b[home][5] && !b[home][6] && !attacked(b, home, 5, opp) && !attacked(b, home, 6, opp)) add(home, 6, { castle: 'K' });
          if (state.castle[col + 'Q'] && b[home][0] === col + 'R' && !b[home][1] && !b[home][2] && !b[home][3] && !attacked(b, home, 3, opp) && !attacked(b, home, 2, opp)) add(home, 2, { castle: 'Q' });
        }
      }
    } else {
      const dirs = t === 'B' ? DIAG : t === 'R' ? ORTH : DIAG.concat(ORTH);
      for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (inb(rr, cc)) { if (!b[rr][cc]) add(rr, cc, {}); else { if (b[rr][cc][0] === opp) add(rr, cc, {}); break; } rr += dr; cc += dc; } }
    }
    return out;
  }
  function apply(state, m) {
    const b = state.board.map(r => r.slice());
    const col = m.piece[0];
    const captured = { w: state.captured.w.slice(), b: state.captured.b.slice() };
    if (m.ep) { b[m.from[0]][m.to[1]] = null; }
    if (m.capture) captured[col].push(m.capture);
    b[m.to[0]][m.to[1]] = m.promo ? col + m.promo : m.piece;
    b[m.from[0]][m.from[1]] = null;
    if (m.castle) { const home = m.from[0]; if (m.castle === 'K') { b[home][5] = b[home][7]; b[home][7] = null; } else { b[home][3] = b[home][0]; b[home][0] = null; } }
    const castle = Object.assign({}, state.castle);
    if (m.piece[1] === 'K') { castle[col + 'K'] = false; castle[col + 'Q'] = false; }
    if (m.piece[1] === 'R') { if (m.from[1] === 0) castle[col + 'Q'] = false; if (m.from[1] === 7) castle[col + 'K'] = false; }
    if (m.capture && m.capture[1] === 'R') { const oc = m.capture[0], oh = oc === 'w' ? 7 : 0; if (m.to[0] === oh && m.to[1] === 0) castle[oc + 'Q'] = false; if (m.to[0] === oh && m.to[1] === 7) castle[oc + 'K'] = false; }
    const ep = m.double ? [(m.from[0] + m.to[0]) / 2, m.from[1]] : null;
    const halfmove = (m.capture || m.piece[1] === 'P') ? 0 : state.halfmove + 1;
    return { board: b, turn: col === 'w' ? 'b' : 'w', castle, ep, halfmove, moves: state.moves.concat([m]), captured };
  }
  function legal(state, r, c) {
    const p = state.board[r][c]; if (!p || p[0] !== state.turn) return [];
    return pseudo(state, r, c).filter(m => !inCheck(apply(state, m), p[0]));
  }
  function allLegal(state) {
    const out = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (state.board[r][c] && state.board[r][c][0] === state.turn) out.push(...legal(state, r, c));
    return out;
  }
  function insufficient(board) {
    const pieces = [];
    for (const row of board) for (const p of row) if (p && p[1] !== 'K') pieces.push(p);
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && (pieces[0][1] === 'B' || pieces[0][1] === 'N')) return true;
    return false;
  }
  function status(state) {
    const moves = allLegal(state), check = inCheck(state, state.turn);
    if (moves.length === 0) return check ? { over: true, result: 'checkmate', winner: state.turn === 'w' ? 'b' : 'w' } : { over: true, result: 'stalemate' };
    if (insufficient(state.board)) return { over: true, result: 'insufficient' };
    if (state.halfmove >= 100) return { over: true, result: 'fifty' };
    return { over: false, check };
  }
  function sameMove(a, b) { return a.from[0] === b.from[0] && a.from[1] === b.from[1] && a.to[0] === b.to[0] && a.to[1] === b.to[1]; }
  const sq = ([r, c]) => 'abcdefgh'[c] + (8 - r);
  function san(state, m) {
    if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
    const t = m.piece[1];
    let s = t === 'P' ? (m.capture ? sq(m.from)[0] : '') : t;
    if (m.capture) s += 'x';
    s += sq(m.to);
    if (m.promo) s += '=' + m.promo;
    const st = status(apply(state, m));
    if (st.over && st.result === 'checkmate') s += '#'; else if (st.check) s += '+';
    return s;
  }
  // ---- simple AI ----
  const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  const CENTER = [[0, 0, 0, 0, 0, 0, 0, 0], [0, 2, 2, 2, 2, 2, 2, 0], [0, 2, 4, 5, 5, 4, 2, 0], [0, 2, 5, 8, 8, 5, 2, 0], [0, 2, 5, 8, 8, 5, 2, 0], [0, 2, 4, 5, 5, 4, 2, 0], [0, 2, 2, 2, 2, 2, 2, 0], [0, 0, 0, 0, 0, 0, 0, 0]];
  function evaluate(state, forColor) {
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c]; if (!p) continue;
      let v = VAL[p[1]] + (p[1] === 'K' ? 0 : CENTER[r][c]);
      if (p[1] === 'P') v += p[0] === 'w' ? (6 - r) * 4 : (r - 1) * 4;
      s += p[0] === forColor ? v : -v;
    }
    return s;
  }
  function search(state, depth, alpha, beta, forColor) {
    const st = status(state);
    if (st.over) { if (st.result === 'checkmate') return st.winner === forColor ? 100000 + depth : -100000 - depth; return 0; }
    if (depth === 0) return evaluate(state, forColor);
    const moves = allLegal(state).sort((a, b) => (b.capture ? VAL[b.capture[1]] : 0) - (a.capture ? VAL[a.capture[1]] : 0));
    const maxing = state.turn === forColor;
    let best = maxing ? -Infinity : Infinity;
    for (const m of moves) {
      const v = search(apply(state, m), depth - 1, alpha, beta, forColor);
      if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
      if (beta <= alpha) break;
    }
    return best;
  }
  function bestMove(state, level) {
    const moves = allLegal(state); if (!moves.length) return null;
    const me = state.turn;
    if (level === 1) { // easy: prefer captures, otherwise random, avoid hanging the queen sometimes
      const caps = moves.filter(m => m.capture);
      const pool = (caps.length && Math.random() < 0.7) ? caps : moves;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const depth = level === 2 ? 2 : 3;
    let scored = moves.map(m => ({ m, v: search(apply(state, m), depth - 1, -Infinity, Infinity, me) + Math.random() * 6 }));
    scored.sort((a, b) => b.v - a.v);
    return scored[0].m;
  }
  function perft(state, d) { if (d === 0) return 1; let n = 0; for (const m of allLegal(state)) n += perft(apply(state, m), d - 1); return n; }
  return { initial, legal, allLegal, apply, status, inCheck, sameMove, san, sq, bestMove, perft, findKing, parse };
})();
if (typeof module !== 'undefined') module.exports = Chess;
