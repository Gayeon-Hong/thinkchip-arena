// 무궁화 꽃이 피었습니다 — hold to move forward; release before the tagger turns around. Real-time, 25 s limit.
import {seededRandom, lvl, byLevel} from '../util.js';
export const RL_GOAL = 100, RL_TIME = 25000, RL_SPEED = 0.02, RL_GRACE = 180; // speed: units per ms (20/s)
// green duration range, warning length, red length, chance of a fake-out (warning but no turn)
const CFG = [{g: [1500, 3300], w: 420, r: [1400, 2300], fake: 0}, {g: [1100, 2800], w: 300, r: [1500, 2500], fake: 0.12},
  {g: [800, 2300], w: 240, r: [1500, 2600], fake: 0.2}, {g: [600, 1900], w: 200, r: [1600, 2700], fake: 0.28}, {g: [450, 1500], w: 195, r: [1600, 2800], fake: 0.35}];
export function createRedLight(seed, difficulty = 'normal') {
  const c = CFG[lvl(difficulty)], r = seededRandom(`rl:${seed}:${difficulty}`), phases = [];
  let t = 0;
  while (t < RL_TIME + 5000) {
    const heat = 1 - 0.45 * Math.min(1, t / RL_TIME); // the longer you play, the faster the tagger
    const g = (c.g[0] + r() * (c.g[1] - c.g[0])) * heat, w = Math.max(150, c.w * (0.75 + 0.25 * heat)), red = c.r[0] + r() * (c.r[1] - c.r[0]);
    phases.push({type: 'green', start: t, end: t + g}); t += g;
    if (r() < c.fake) { phases.push({type: 'warn', fake: true, start: t, end: t + w}); t += w; continue; } // 페이크: 돌아보는 척만
    phases.push({type: 'warn', start: t, end: t + w}); t += w;
    phases.push({type: 'red', start: t, end: t + red}); t += red;
  }
  return {seed, difficulty, phases, t: 0, pos: 0, caught: false, finished: false, timeout: false, score: 0, over: false};
}
export const phaseAt = (g, t) => g.phases.find((p) => t >= p.start && t < p.end) ?? g.phases.at(-1);
export const finishScore = (g) => (g.finished ? 100 + Math.max(0, Math.round(((RL_TIME - g.t) / 1000) * 3)) : Math.round(g.pos * 0.6));
// Advance the simulation by dt ms. Movement only counts while holding outside the red phase.
export function stepRedLight(g, dt, holding) {
  if (g.over || dt <= 0) return g;
  let {t, pos} = g;
  const end = Math.min(t + dt, RL_TIME);
  while (t < end) {
    const ph = phaseAt(g, t), until = Math.min(end, ph.end);
    if (holding) {
      if (ph.type === 'red') {
        const grace = byLevel(g.difficulty, [180, 140, 110, 90, 82]);
        if (until - ph.start > grace) { const tt = Math.max(t, ph.start + grace); const n = {...g, t: tt, pos, caught: true, over: true}; return {...n, score: finishScore(n)}; }
      } else {
        pos += (until - t) * RL_SPEED;
        if (pos >= RL_GOAL) { const tt = until - (pos - RL_GOAL) / RL_SPEED; const n = {...g, t: tt, pos: RL_GOAL, finished: true, over: true}; return {...n, score: finishScore(n)}; }
      }
    }
    t = until;
  }
  const n = {...g, t, pos};
  if (t >= RL_TIME) return {...n, timeout: true, over: true, score: finishScore(n)};
  return n;
}
const BOT = [124, 128, 130, 126, 112];
export function redLightBotTarget(seed, difficulty = 'normal') {
  const r = seededRandom(`rlbot:${seed}:${difficulty}`);
  return BOT[lvl(difficulty)] + Math.round(r() * 6);
}
export const redLightAdvice = () => ({warn: true, note: '힌트 켜짐: 술래가 돌아보기 직전에 화면이 빨갛게 번쩍여요. 번쩍이면 바로 손을 떼세요!'});
