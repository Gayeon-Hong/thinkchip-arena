// 숫자 탐정 — classic "bulls and cows" (숫자 야구). Find the hidden 3-digit code (1-9, no repeats).
import {seededRandom, shuffle, byLevel} from '../util.js';
export const BB_LEN = 3, BB_TRIES = 8;
const DIGITS = [1,2,3,4,5,6,7,8,9];
export function createBaseball(seed, difficulty='normal') {
  const r = seededRandom(`baseball:${seed}`);
  const secret = shuffle(DIGITS, r).slice(0, BB_LEN);
  return {seed, difficulty, secret, turn:0, history:[], score:0, cpuScore:0, solved:false, over:false, last:null};
}
export function judge(secret, guess) {
  let strike = 0, ball = 0;
  guess.forEach((d, i) => { if (secret[i] === d) strike++; else if (secret.includes(d)) ball++; });
  return {strike, ball};
}
export function validGuess(guess) { return Array.isArray(guess) && guess.length === BB_LEN && new Set(guess).size === BB_LEN && guess.every(d => DIGITS.includes(d)); }
const scoreFor = (tries) => Math.max(10, 110 - tries * 10); // solved in 1 try = 100 ... 8 tries = 30
export function playBaseball(g, guess) {
  if (g.over || !validGuess(guess)) return g;
  const res = judge(g.secret, guess), turn = g.turn + 1, solved = res.strike === BB_LEN;
  const over = solved || turn >= BB_TRIES;
  return {...g, turn, solved, over, history:[...g.history, {guess, ...res}], last:{guess, ...res}, score: solved ? scoreFor(turn) : 0};
}
const allCodes = (() => { const out = []; for (const a of DIGITS) for (const b of DIGITS) for (const c of DIGITS) if (a!==b && b!==c && a!==c) out.push([a,b,c]); return out; })();
export function candidates(history) { return allCodes.filter(code => history.every(h => { const j = judge(code, h.guess); return j.strike === h.strike && j.ball === h.ball; })); }
export function baseballAdvice(g) {
  const c = candidates(g.history);
  const pick = c[seededRandom(`bbhint:${g.seed}:${g.turn}`)() * c.length | 0] || [1,2,3];
  return {guess: pick, note: `가능한 정답이 ${c.length}개 남았어요. ${pick.join('')} 을(를) 시도해 보세요.`};
}
// AI opponent solves its own hidden code from the same seed; its result becomes the target score.
// baseballBotRun: AI 가 실제로 한 추리 과정 (AI 차례 화면에서 한 줄씩 보여줘요)
export function baseballBotRun(seed, difficulty='normal') {
  const r = seededRandom(`bbbot:${seed}:${difficulty}`);
  const secret = shuffle(DIGITS, seededRandom(`baseball-ai:${seed}`)).slice(0, BB_LEN);
  const sloppy = byLevel(difficulty, [.3, .15, .05, 0, 0]), smart = byLevel(difficulty, [0, 0, 0, 0.6, 1]);
  const history = [];
  for (let t = 1; t <= BB_TRIES; t++) {
    const pool = r() < sloppy ? allCodes : candidates(history);
    let guess = pool[r() * pool.length | 0];
    if (pool.length > 2 && r() < smart) { // pick the guess that splits the remaining candidates best
      let best = Infinity;
      for (const g of pool.slice(0, 40)) { const parts = {}; for (const c of pool) { const j = judge(c, g); const k = `${j.strike}${j.ball}`; parts[k] = (parts[k] || 0) + 1; } const worst = Math.max(...Object.values(parts)); if (worst < best) { best = worst; guess = g; } }
    }
    const j = judge(secret, guess); history.push({guess, ...j});
    if (j.strike === BB_LEN) return {secret, history, solved: true, score: scoreFor(t)};
  }
  return {secret, history, solved: false, score: 0};
}
export function baseballBotTarget(seed, difficulty='normal') { return baseballBotRun(seed, difficulty).score; }
