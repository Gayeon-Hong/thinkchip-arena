// 스도쿠 — classic 9x9. Seeded puzzle with a unique solution; fewer givens at higher levels.
// Score: up to 1000 by speed (vs. a par time), minus 60 per mistake. 3 mistakes = game over.
import {seededRandom, shuffle, byLevel} from '../util.js';
export const SD_MAX_MISTAKES = 3;
const rowOf = (i) => (i / 9) | 0, colOf = (i) => i % 9, boxOf = (i) => ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0);
const PEERS = Array.from({length: 81}, (_, i) => { const s = new Set(); for (let j = 0; j < 81; j++) if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) s.add(j); return [...s]; });
const ok = (g, i, n) => PEERS[i].every((j) => g[j] !== n);
function fill(g, r) {
  const i = g.indexOf(0); if (i < 0) return true;
  for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], r)) { if (ok(g, i, n)) { g[i] = n; if (fill(g, r)) return true; g[i] = 0; } }
  return false;
}
// Counts solutions up to `limit` (we only need to know "exactly one").
function count(g, limit = 2) {
  let best = -1, bestOpts = null;
  for (let i = 0; i < 81; i++) if (!g[i]) { const opts = []; for (let n = 1; n <= 9; n++) if (ok(g, i, n)) opts.push(n); if (!opts.length) return 0; if (!bestOpts || opts.length < bestOpts.length) { best = i; bestOpts = opts; if (opts.length === 1) break; } }
  if (best < 0) return 1;
  let total = 0;
  for (const n of bestOpts) { g[best] = n; total += count(g, limit - total); g[best] = 0; if (total >= limit) break; }
  return total;
}
export function createSudoku(seed, difficulty = 'normal') {
  const r = seededRandom(`sudoku:${seed}`), solution = Array(81).fill(0); fill(solution, r);
  const puzzle = [...solution], target = byLevel(difficulty, [40, 34, 30, 27, 25]);
  let filled = 81;
  for (const i of shuffle([...Array(81).keys()], r)) {
    if (filled <= target) break;
    const keep = puzzle[i]; puzzle[i] = 0;
    if (count([...puzzle]) !== 1) puzzle[i] = keep; else filled--;
  }
  const par = byLevel(difficulty, [300, 420, 540, 660, 780]) * 1000;
  return {seed, difficulty, solution, givens: puzzle.map((v) => v > 0), board: [...puzzle], mistakes: 0, par, score: 0, cpuScore: 0, over: false, solved: false, last: null, turn: 0};
}
export const sudokuLeft = (g) => g.board.filter((v) => !v).length;
// Place n at cell i. Wrong numbers are not placed and cost a mistake. `ms` = elapsed time so far.
export function playSudoku(g, i, n, ms = 0) {
  if (g.over || g.givens[i] || g.board[i] || !(n >= 1 && n <= 9)) return g;
  if (g.solution[i] !== n) {
    const mistakes = g.mistakes + 1, over = mistakes >= SD_MAX_MISTAKES;
    return {...g, mistakes, over, score: over ? 0 : g.score, last: {i, n, ok: false}, turn: g.turn + 1};
  }
  const board = [...g.board]; board[i] = n;
  const solved = board.every((v) => v > 0);
  const score = solved ? Math.max(100, Math.round(1000 * Math.min(1, g.par / Math.max(1, ms))) - g.mistakes * 60) : 0;
  return {...g, board, solved, over: solved, score, last: {i, n, ok: true}, turn: g.turn + 1};
}
export function sudokuBotTarget(seed, difficulty = 'normal') { const r = seededRandom(`sdbot:${seed}`); return byLevel(difficulty, [620, 660, 700, 740, 780]) + Math.round(r() * 40); }
export function sudokuAdvice(g, sel) {
  // Prefer the selected cell; otherwise the empty cell with the fewest candidates.
  let best = Number.isInteger(sel) && !g.board[sel] ? sel : -1, bestN = 10;
  if (best < 0) for (let i = 0; i < 81; i++) if (!g.board[i]) { const c = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => ok(g.board, i, n)).length; if (c < bestN) { bestN = c; best = i; } }
  return {cell: best, n: g.solution[best], note: `${rowOf(best) + 1}행 ${colOf(best) + 1}열에는 ${g.solution[best]}이(가) 들어가요.`};
}
