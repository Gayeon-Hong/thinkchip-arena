// 징검다리 건너기 — memorise which stepping stone is safe, then cross. 3 stages (4/6/8 steps).
import {seededRandom, lvl, byLevel} from '../util.js';
const LENS = [[5, 7, 9], [5, 8, 10], [6, 9, 11], [6, 9, 12], [7, 10, 13]];
const WIDE = [[2, 2, 2], [2, 2, 2], [2, 2, 3], [2, 3, 3], [3, 3, 3]]; // stones per step
export const BR_STAGES = LENS[1];
export function createBridge(seed, difficulty = 'normal') {
  const l = lvl(difficulty), lens = LENS[l], widths = WIDE[l];
  const stages = lens.map((n, s) => { const r = seededRandom(`br:${seed}:${s}`); return Array.from({length: n}, () => Math.floor(r() * widths[s])); });
  const lives = [3, 3, 3, 2, 2][l], base = [560, 480, 420, 360, 300][l];
  const previews = lens.map((_, s) => Math.round(base * (1 - 0.14 * s))); // every stage flashes faster
  return {seed, difficulty, stages, widths, previews, previewMs: previews[0], stage: 0, step: 0, lives, maxLives: lives, broken: [], score: 0, over: false, last: null, cleared: 0};
}
export function playBridge(g, side) {
  const w = g.widths?.[g.stage] ?? 2, broken = Array.isArray(g.broken) ? g.broken : g.broken === null || g.broken === undefined ? [] : [g.broken];
  if (g.over || !Number.isInteger(side) || side < 0 || side >= w || broken.includes(side)) return g;
  const safe = g.stages[g.stage][g.step];
  if (side !== safe) {
    const lives = g.lives - 1;
    return {...g, lives, broken: [...broken, side], last: {ok: false, stage: g.stage, step: g.step}, over: lives <= 0};
  }
  let {stage, step, score, cleared} = g, stageClear = false;
  score += broken.length ? 0 : 10; step += 1;
  if (step >= g.stages[stage].length) { score += 20; stage += 1; step = 0; stageClear = true; cleared += 1; }
  const over = stage >= g.stages.length;
  if (over) score += g.lives * 10;
  const nextStage = over ? g.stages.length - 1 : stage;
  return {...g, stage: nextStage, step, score, cleared, broken: [], previewMs: g.previews ? g.previews[nextStage] : g.previewMs, last: {ok: true, stageClear}, over};
}
// AI 도 같은 다리를 실제로 건너요: 단계가 올라갈수록 기억이 흐려져요. 한 칸씩 고른 기록(moves)을 AI 차례 화면에서 보여줘요.
const BOT_MEM = [0.78, 0.83, 0.905, 0.955, 0.98];
export function bridgeBotRun(seed, difficulty = 'normal') {
  const r = seededRandom(`brbot:${seed}:${difficulty}`), l = lvl(difficulty);
  let g = createBridge(seed, difficulty); const moves = [];
  for (let guard = 0; !g.over && guard < 200; guard++) {
    const w = g.widths[g.stage], safe = g.stages[g.stage][g.step], broken = g.broken || [];
    const remember = r() < BOT_MEM[l] - 0.03 * g.stage;
    let side = safe;
    if (!remember) { const opts = Array.from({length: w}, (_, i) => i).filter((i) => !broken.includes(i)); side = opts[Math.floor(r() * opts.length)]; }
    const before = {stage: g.stage, step: g.step, lives: g.lives, width: w};
    g = playBridge(g, side); moves.push({...before, side, ok: !!g.last?.ok, stageClear: !!g.last?.stageClear});
  }
  return {moves, score: g.score, cleared: g.cleared, lives: g.lives, total: g.stages.length};
}
export function bridgeBotTarget(seed, difficulty = 'normal') { return bridgeBotRun(seed, difficulty).score; }
export const bridgeAdvice = (g) => { const side = g.stages[g.stage][g.step], w = g.widths?.[g.stage] ?? 2; return {side, note: `이번 칸은 ${w === 3 ? ['왼쪽', '가운데', '오른쪽'][side] : side ? '오른쪽' : '왼쪽'}이 안전해요!`}; };
