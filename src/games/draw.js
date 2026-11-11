// 그대로 그리기 — draw the outline in one stroke. 5 rounds, each shape harder and judged stricter.
import {seededRandom, shuffle, lvl, byLevel} from '../util.js';
import {distToPolyline, resample} from './geometry.js';
export const DRAW_SIZE = 300, DRAW_ROUNDS = 5;
const C = 150, R = 105;
const SHAPES = {
  heart: {name: '하트', icon: '♥', pts: Array.from({length: 120}, (_, i) => { const t = (i / 120) * Math.PI * 2; return [C + 6.4 * 16 * Math.sin(t) ** 3, 158 - 6.4 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; })},
  chip: {name: '씽크칩', icon: '⬡', pts: Array.from({length: 6}, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return [C + R * Math.cos(a), C + R * Math.sin(a)]; })},
  circle: {name: '동그라미', icon: '●', pts: Array.from({length: 90}, (_, i) => { const a = (i / 90) * Math.PI * 2; return [C + R * Math.cos(a), C + R * Math.sin(a)]; })},
  triangle: {name: '세모', icon: '▲', pts: Array.from({length: 3}, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3; return [C + R * Math.cos(a), C + 12 + R * Math.sin(a)]; })},
  star: {name: '별', icon: '★', pts: Array.from({length: 10}, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.42 : R; return [C + rr * Math.cos(a), C + 8 + rr * Math.sin(a)]; })},
  bolt: {name: '번개', icon: '⚡', pts: [[176, 28], [92, 160], [146, 160], [118, 272], [208, 126], [154, 126], [186, 28]]},
};
// Rounds go from easy outlines to tricky ones; within a tier the order is seeded.
const TIERS = [['circle', 'triangle'], ['heart', 'chip'], ['star', 'bolt']];
export const shapeOf = (id) => SHAPES[id];
export function createDraw(seed, difficulty = 'normal') {
  const r = seededRandom(`draw:${seed}`), t = TIERS.map((x) => shuffle(x, r));
  const order = [t[0][0], t[0][1], t[1][0], t[1][1], t[2][r() < 0.5 ? 0 : 1]];
  return {seed, difficulty, order, turn: 0, score: 0, cpuScore: 0, results: [], over: false, last: null};
}
// Similarity 0..100: how close the stroke stays to the outline + how much of the outline it covers.
export function drawTolerance(difficulty = 'normal', round = 0) { return byLevel(difficulty, [34, 28, 23, 19, 15.5]) * (1 - 0.05 * round); }
export function scoreStroke(shapeId, stroke, tol = 34) {
  const shape = SHAPES[shapeId];
  const len = stroke.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - stroke[i][0], q[1] - stroke[i][1]), 0);
  if (!shape || stroke.length < 2 || len < 60) return 0; // a tap or tiny scribble scores nothing
  const outline = resample([...shape.pts, shape.pts[0]], 160), drawn = resample(stroke, 160);
  const meanDist = drawn.reduce((a, p) => a + distToPolyline(p, shape.pts, true), 0) / drawn.length;
  const covered = outline.filter((o) => drawn.some((d) => Math.hypot(d[0] - o[0], d[1] - o[1]) <= tol * 0.42)).length / outline.length;
  const closeness = Math.max(0, 1 - meanDist / tol);
  return Math.round(100 * closeness * (0.25 + 0.75 * covered)); // half a shape can't score high
}
export function playDraw(g, stroke) {
  if (g.over) return g;
  const id = g.order[g.turn], pts = scoreStroke(id, stroke, drawTolerance(g.difficulty, g.turn)), turn = g.turn + 1;
  return {...g, turn, score: g.score + pts, results: [...g.results, {id, pts}], last: {id, pts}, over: turn >= DRAW_ROUNDS};
}
export function drawBotTarget(seed, difficulty = 'normal') {
  const r = seededRandom(`drawbot:${seed}:${difficulty}`);
  return byLevel(difficulty, [330, 370, 400, 425, 445]) + Math.round(r() * 15);
}
export const drawAdvice = (g) => ({note: `${SHAPES[g.order[g.turn]].name}: 점선 위를 손을 떼지 않고 한 바퀴 그리세요. 끝까지 둘러야 점수가 높아요.`, guide: true});
