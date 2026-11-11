// 오목 — 13x13, five in a row wins. Black (player 0) moves first. Works vs AI or 1:1 live (same engine, replayed moves).
import {seededRandom, byLevel, lvl} from '../util.js';
export const GM_N = 13;
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
export function createGomoku(seed, difficulty = 'normal', meFirst = true) {
  return {seed, difficulty, board: Array(GM_N * GM_N).fill(-1), turn: 0, toMove: 0, meIdx: meFirst ? 0 : 1, moves: [], winner: null, line: null, over: false, score: 0, cpuScore: 0, last: null};
}
const at = (b, x, y) => (x < 0 || y < 0 || x >= GM_N || y >= GM_N ? -2 : b[y * GM_N + x]);
function fiveFrom(b, i) {
  const x = i % GM_N, y = (i / GM_N) | 0, c = b[i];
  for (const [dx, dy] of DIRS) {
    const cells = [i];
    for (let s = 1; at(b, x + dx * s, y + dy * s) === c; s++) cells.push((y + dy * s) * GM_N + x + dx * s);
    for (let s = 1; at(b, x - dx * s, y - dy * s) === c; s++) cells.push((y - dy * s) * GM_N + x - dx * s);
    if (cells.length >= 5) return cells;
  }
  return null;
}
// Apply a move for whoever is to move. Scores: winner 100 (+ speed bonus), loser 0.
export function playGomoku(g, i) {
  if (g.over || !(i >= 0 && i < GM_N * GM_N) || g.board[i] !== -1) return g;
  const board = [...g.board]; board[i] = g.toMove;
  const line = fiveFrom(board, i), moves = [...g.moves, i], full = moves.length >= GM_N * GM_N;
  const winner = line ? g.toMove : full ? 'draw' : null, over = winner !== null;
  const bonus = Math.max(0, 40 - Math.floor(moves.length / 2));
  const score = winner === g.meIdx ? 100 + bonus : winner === 'draw' ? 50 : 0, cpuScore = winner === 1 - g.meIdx ? 100 + bonus : winner === 'draw' ? 50 : 0;
  return {...g, board, moves, toMove: 1 - g.toMove, turn: g.turn + 1, winner, line, over, score: over ? score : 0, cpuScore: over ? cpuScore : 0, last: {i, by: g.toMove}};
}
// Value of placing colour c at i: sum over every 5-cell window through i that the opponent hasn't blocked
// (handles gapped shapes like X X _ X too).
const W = [0, 1, 12, 160, 3000, 1e6];
function value(b, i, c) {
  const x = i % GM_N, y = (i / GM_N) | 0; let v = 0;
  for (const [dx, dy] of DIRS) for (let k = -4; k <= 0; k++) {
    let n = 0, blocked = false;
    for (let s = k; s < k + 5; s++) { const q = at(b, x + dx * s, y + dy * s); if (s === 0) { n++; continue; } if (q === -2 || (q >= 0 && q !== c)) { blocked = true; break; } if (q === c) n++; }
    if (!blocked) v += W[n];
  }
  return v;
}
export function gomokuAI(g) {
  const b = g.board, me = g.toMove, foe = 1 - me, l = lvl(g.difficulty), r = seededRandom(`gmai:${g.seed}:${g.moves.length}`);
  if (!g.moves.length) return ((GM_N / 2) | 0) * GM_N + ((GM_N / 2) | 0);
  const defend = [0.5, 0.7, 0.82, 0.88, 0.92][l], noise = [0.5, 0.3, 0.15, 0.06, 0][l], sees = [0.7, 0.9, 1, 1, 1][l];
  // 1) win now  2) block the opponent's win
  for (const c of [me, foe]) { if (c === foe && r() > sees) break; for (let i = 0; i < b.length; i++) if (b[i] === -1) { const t = [...b]; t[i] = c; if (fiveFrom(t, i)) return i; } }
  let best = -1, bestV = -Infinity;
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== -1) continue;
    const x = i % GM_N, y = (i / GM_N) | 0; let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (at(b, x + dx, y + dy) >= 0) { near = true; break; }
    if (!near) continue;
    const v = value(b, i, me) * 1.0 + value(b, i, foe) * defend;
    const vv = v * (1 + (r() - 0.5) * 2 * noise);
    if (vv > bestV) { bestV = vv; best = i; }
  }
  return best;
}
export function gomokuAdvice(g) { const i = gomokuAI({...g, difficulty: 'master'}); return {cell: i, note: `${((i / GM_N) | 0) + 1}행 ${(i % GM_N) + 1}열이 좋아 보여요. 상대의 열린 3·4를 먼저 막으세요!`}; }
