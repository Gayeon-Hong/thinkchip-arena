// 땅따먹기 (점 잇기) — 4x4 boxes. Take turns drawing one line; closing a box scores it and you go again.
import {seededRandom, lvl} from '../util.js';
export const DB_N = 4; // boxes per side
// Lines: horizontals h(r,c) r=0..N, c=0..N-1  then verticals v(r,c) r=0..N-1, c=0..N
export const DB_H = (r, c) => r * DB_N + c, DB_V = (r, c) => (DB_N + 1) * DB_N + r * (DB_N + 1) + c;
export const DB_LINES = 2 * DB_N * (DB_N + 1);
const boxLines = (r, c) => [DB_H(r, c), DB_H(r + 1, c), DB_V(r, c), DB_V(r, c + 1)];
const DB_BOXES = Array.from({length: DB_N * DB_N}, (_, k) => boxLines((k / DB_N) | 0, k % DB_N));
const DB_LINE_BOXES = Array.from({length: DB_LINES}, (_, li) => DB_BOXES.map((ls, k) => (ls.includes(li) ? k : -1)).filter((k) => k >= 0));
export function createDots(seed, difficulty = 'normal', meFirst = true) {
  return {seed, difficulty, lines: Array(DB_LINES).fill(-1), owner: Array(DB_N * DB_N).fill(-1), toMove: 0, meIdx: meFirst ? 0 : 1, moves: [], pts: [0, 0], over: false, winner: null, score: 0, cpuScore: 0, last: null, turn: 0};
}
const sides = (lines, k) => DB_BOXES[k].filter((l) => lines[l] >= 0).length;
export function playDots(g, li) {
  if (g.over || !(li >= 0 && li < DB_LINES) || g.lines[li] >= 0) return g;
  const lines = [...g.lines]; lines[li] = g.toMove;
  const owner = [...g.owner], pts = [...g.pts]; let closed = 0;
  for (const k of DB_LINE_BOXES[li]) if (owner[k] < 0 && sides(lines, k) === 4) { owner[k] = g.toMove; pts[g.toMove]++; closed++; }
  const over = lines.every((x) => x >= 0), toMove = closed ? g.toMove : 1 - g.toMove;
  const winner = over ? (pts[0] === pts[1] ? 'draw' : pts[0] > pts[1] ? 0 : 1) : null;
  return {...g, lines, owner, pts, toMove, over, winner, moves: [...g.moves, li], score: pts[g.meIdx] * 10, cpuScore: pts[1 - g.meIdx] * 10, last: {li, by: g.toMove, closed}, turn: g.turn + 1};
}
// AI: take any box; otherwise avoid giving a 3rd side; when forced, give the smallest chain.
export function dotsAI(g) {
  const l = lvl(g.difficulty), r = seededRandom(`dbai:${g.seed}:${g.moves.length}`);
  const free = g.lines.map((v, i) => (v < 0 ? i : -1)).filter((i) => i >= 0);
  const closes = free.filter((li) => DB_LINE_BOXES[li].some((k) => g.owner[k] < 0 && sides(g.lines, k) === 3));
  if (closes.length && r() < [0.75, 0.92, 1, 1, 1][l]) return closes[(r() * closes.length) | 0];
  const safe = free.filter((li) => DB_LINE_BOXES[li].every((k) => sides(g.lines, k) < 2));
  if (safe.length && r() < [0.5, 0.8, 0.95, 1, 1][l]) return safe[(r() * safe.length) | 0];
  if (l >= 2) { // give away as few boxes as possible
    let best = free[0], bestCost = Infinity;
    for (const li of free) { let sim = {...g, toMove: 1 - g.toMove}; sim = playDots({...sim, toMove: sim.toMove}, li); let cost = 0, guard = 0;
      // simulate the opponent greedily taking boxes
      while (!sim.over && guard++ < 30) { const c = sim.lines.map((v, i) => (v < 0 ? i : -1)).filter((i) => i >= 0 && DB_LINE_BOXES[i].some((k) => sim.owner[k] < 0 && sides(sim.lines, k) === 3)); if (!c.length) break; sim = playDots(sim, c[0]); cost++; }
      if (cost < bestCost) { bestCost = cost; best = li; } }
    return best;
  }
  return free[(r() * free.length) | 0];
}
export function dotsAdvice(g) { const li = dotsAI({...g, difficulty: 'master'}); return {line: li, note: '빛나는 선을 그어 보세요. 상자의 세 번째 변을 그어주면 상대가 가져가요!'}; }
