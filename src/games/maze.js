// 닿지 마! — drag a dot through a winding corridor without touching the walls.
// 5 stages: every stage the corridor gets tighter and YOUR dot gets bigger. Difficulty sets how fast.
import {seededRandom, lvl, byLevel} from '../util.js';
import {distToPolyline} from './geometry.js';
export const MAZE_W = 300, MAZE_H = 420, MAZE_STAGES = 5;
// clear = free room for the dot's centre; dot = dot radius. Visual corridor half-width = clear + dot.
export function mazeStageSize(difficulty, s) {
  const l = lvl(difficulty), base = [24, 20, 16.5, 13.5, 11][l];
  const clear = Math.max(4.5, base - s * [1.8, 2.2, 2.5, 2.4, 1.6][l]), dot = 5 + s * [1.2, 1.6, 2.1, 2.6, 3.1][l];
  return {clear: Math.round(clear * 10) / 10, dot: Math.round(dot * 10) / 10, half: Math.round((clear + dot) * 10) / 10};
}
function makePath(seed, stage) {
  const r = seededRandom(`maze:${seed}:${stage}`), rows = 5 + Math.min(stage, 4), pts = [[52, 42]];
  for (let i = 1; i <= rows; i++) {
    const y = 30 + (360 * i) / rows;
    const x = i % 2 ? 210 + r() * 50 : 40 + r() * 50;      // zig-zag left/right
    pts.push([x, y - 360 / rows / 2 + r() * 10]); pts.push([x, y]);
  }
  return pts;
}
export function createMaze(seed, difficulty = 'normal') {
  const stages = Array.from({length: MAZE_STAGES}, (_, s) => ({points: makePath(seed, s), ...mazeStageSize(difficulty, s)}));
  return {seed, difficulty, stages, turn: 0, score: 0, cpuScore: 0, results: [], over: false, last: null};
}
export function insideCorridor(stage, p) { return distToPolyline(p, stage.points) <= (stage.clear ?? stage.half); }
// Judge a whole drag. trace = [[x,y,ms],...] in board coordinates.
export function judgeTrace(stage, trace) {
  if (!trace.length) return {ok: false, reason: 'empty', progress: 0};
  const start = stage.points[0], goal = stage.points.at(-1);
  if (Math.hypot(trace[0][0] - start[0], trace[0][1] - start[1]) > stage.half + 10) return {ok: false, reason: 'start', progress: 0};
  for (let i = 0; i < trace.length; i++) {
    if (!insideCorridor(stage, trace[i])) return {ok: false, reason: 'touch', progress: i / trace.length, at: trace[i]};
    if (Math.hypot(trace[i][0] - goal[0], trace[i][1] - goal[1]) <= stage.half) return {ok: true, ms: Math.max(0, trace[i][2] - trace[0][2])};
  }
  return {ok: false, reason: 'lift', progress: 1};
}
export const stagePoints = (res) => res.ok ? 40 + Math.max(0, Math.round(20 - res.ms / 750)) : 0; // 40 + up to 20 speed bonus
export function playMaze(g, trace) {
  if (g.over) return g;
  const res = judgeTrace(g.stages[g.turn], trace), pts = stagePoints(res), turn = g.turn + 1;
  return {...g, turn, score: g.score + pts, results: [...g.results, {...res, pts}], last: {...res, pts}, over: turn >= MAZE_STAGES};
}
export function mazeBotTarget(seed, difficulty = 'normal') {
  const r = seededRandom(`mazebot:${seed}:${difficulty}`);
  return byLevel(difficulty, [150, 185, 215, 240, 262]) + Math.round(r() * 18);
}
export const mazeAdvice = (g) => ({note: `${g.turn + 1}단계: 여유 폭 ${Math.round(g.stages[g.turn].clear * 2)}px, 내 점 지름 ${Math.round(g.stages[g.turn].dot * 2)}px. 가운데 점선만 따라가세요!`, guide: true});
