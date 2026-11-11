// 숫자 합치기 — slide a 4x4 board; equal tiles merge. Limited moves; seeded spawns so friends get the same tiles.
import {seededRandom, byLevel} from '../util.js';
export const MG_SIZE = 4;
const MG_DIRS = ['up', 'down', 'left', 'right'];
function spawn(board, seed, move, four) {
  const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0); if (!empty.length) return board;
  const r = seededRandom(`merge:${seed}:${move}`), b = [...board];
  b[empty[(r() * empty.length) | 0]] = r() < four ? 4 : 2; return b;
}
export function createMerge(seed, difficulty = 'normal') {
  const four = byLevel(difficulty, [0.1, 0.15, 0.22, 0.3, 0.38]), moves = byLevel(difficulty, [160, 140, 120, 105, 90]);
  let board = Array(16).fill(0); board = spawn(board, seed, -1, four); board = spawn(board, seed, -2, four);
  return {seed, difficulty, four, board, moves, used: 0, score: 0, cpuScore: 0, best: 2, over: false, last: null, turn: 0};
}
function line(vals) { // slide one line toward index 0
  const v = vals.filter(Boolean), out = []; let gain = 0;
  for (let i = 0; i < v.length; i++) { if (v[i] === v[i + 1]) { out.push(v[i] * 2); gain += v[i] * 2; i++; } else out.push(v[i]); }
  while (out.length < 4) out.push(0); return {out, gain};
}
export function slide(board, dir) {
  const b = [...board]; let gain = 0, moved = false;
  for (let k = 0; k < 4; k++) {
    const idx = [0, 1, 2, 3].map((j) => (dir === 'left' ? k * 4 + j : dir === 'right' ? k * 4 + 3 - j : dir === 'up' ? j * 4 + k : (3 - j) * 4 + k));
    const {out, gain: gg} = line(idx.map((i) => b[i])); gain += gg;
    idx.forEach((i, j) => { if (b[i] !== out[j]) moved = true; b[i] = out[j]; });
  }
  return {board: b, gain, moved};
}
export const canMove = (board) => MG_DIRS.some((d) => slide(board, d).moved);
export function playMerge(g, dir) {
  if (g.over || !MG_DIRS.includes(dir)) return g;
  const {board, gain, moved} = slide(g.board, dir); if (!moved) return g;
  const used = g.used + 1, next = spawn(board, g.seed, used, g.four), best = Math.max(...next);
  const over = used >= g.moves || !canMove(next);
  return {...g, board: next, used, score: g.score + gain, best, over, last: {dir, gain}, turn: g.turn + 1};
}
// Bot: greedy "keep the corner" player on the same seed.
export function mergeBotTarget(seed, difficulty = 'normal') {
  let g = createMerge(seed, difficulty);
  const pref = ['down', 'left', 'right', 'up'];
  while (!g.over) {
    let best = null, bestV = -1;
    for (const d of pref) { const s = slide(g.board, d); if (!s.moved) continue; const v = s.gain + s.board.filter((x) => !x).length * 4 + (s.board[12] === Math.max(...s.board) ? 20 : 0) - (d === 'up' ? 30 : 0); if (v > bestV) { bestV = v; best = d; } }
    if (!best) break; g = playMerge(g, best);
  }
  return Math.round(g.score * byLevel(difficulty, [0.95, 1.05, 1.15, 1.25, 1.35]));
}
export function mergeAdvice(g) {
  let best = null, bestV = -1;
  for (const d of ['down', 'left', 'right', 'up']) { const s = slide(g.board, d); if (!s.moved) continue; const v = s.gain + s.board.filter((x) => !x).length * 5 + (s.board[12] === Math.max(...s.board) ? 25 : 0) - (d === 'up' ? 40 : 0); if (v > bestV) { bestV = v; best = d; } }
  return {dir: best, note: `추천: ${({up: '위', down: '아래', left: '왼쪽', right: '오른쪽'})[best] || '-'}로 밀기. 큰 숫자는 한쪽 구석에 모아두세요.`};
}
