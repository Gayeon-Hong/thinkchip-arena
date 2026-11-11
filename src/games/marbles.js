// 홀짝 구슬 — hide marbles in your fist, the other side guesses odd/even and bets. Roles alternate. 10 rounds.
import {seededRandom, byLevel} from '../util.js';
export const MB_START = 10, MB_ROUNDS = 10;
export const parity = (n) => (n % 2 ? 'odd' : 'even');
export const PARITY_KO = {odd: '홀', even: '짝'};
export function createMarbles(seed, difficulty = 'normal') {
  const r = seededRandom(`mb:${seed}`);
  const lean = byLevel(difficulty, [0.32, 0.37, 0.41, 0.44, 0.47]); // how strongly the AI favours one parity
  const oddBias = r() < 0.5 ? lean : 1 - lean;
  return {seed, difficulty, oddBias, me: MB_START, cpu: MB_START, turn: 0, score: MB_START * 10, cpuScore: MB_START * 10, history: [], over: false, last: null};
}
export const roleOf = (g) => (g.turn % 2 === 0 ? 'guess' : 'hide'); // I guess first, then I hide, alternating
export function cpuHide(g) {
  const r = seededRandom(`mbh:${g.seed}:${g.turn}`), wantOdd = r() < g.oddBias, max = Math.max(1, Math.min(g.cpu, 9));
  const opts = Array.from({length: max}, (_, i) => i + 1).filter((n) => (n % 2 === 1) === wantOdd);
  return opts.length ? opts[(r() * opts.length) | 0] : 1;
}
export function cpuGuess(g) {
  const r = seededRandom(`mbg:${g.seed}:${g.turn}`);
  const mine = g.history.filter((h) => h.role === 'hide').map((h) => parity(h.hidden));
  const odd = mine.filter((p) => p === 'odd').length, even = mine.length - odd;
  const read = byLevel(g.difficulty, [0.5, 0.65, 0.78, 0.88, 0.95]); // AI learns your habit
  let guess = r() < 0.5 ? 'odd' : 'even';
  if (mine.length >= 2 && odd !== even && r() < read) guess = odd > even ? 'odd' : 'even';
  const bet = Math.max(1, Math.min(g.cpu, 1 + ((r() * 3) | 0) + byLevel(g.difficulty, [0, 0, 1, 1, 2])));
  return {guess, bet};
}
export function playMarbles(g, move) {
  if (g.over) return g;
  const role = roleOf(g);
  let me = g.me, cpu = g.cpu, rec;
  if (role === 'guess') {
    const bet = Math.floor(move?.bet), guess = move?.guess;
    if (!['odd', 'even'].includes(guess) || !(bet >= 1) || bet > me) return g;
    const hidden = cpuHide(g), win = parity(hidden) === guess, amt = Math.min(bet, win ? cpu : me);
    if (win) { me += amt; cpu -= amt; } else { me -= amt; cpu += amt; }
    rec = {role, hidden, guess, bet, win, amt};
  } else {
    const hidden = Math.floor(move?.hide);
    if (!(hidden >= 1) || hidden > me || hidden > 9) return g;
    const {guess, bet} = cpuGuess(g), cpuWin = parity(hidden) === guess, amt = Math.min(bet, cpuWin ? me : cpu);
    if (cpuWin) { me -= amt; cpu += amt; } else { me += amt; cpu -= amt; }
    rec = {role, hidden, guess, bet, win: !cpuWin, amt};
  }
  const turn = g.turn + 1, over = me <= 0 || cpu <= 0 || turn >= MB_ROUNDS;
  return {...g, me, cpu, turn, score: me * 10, cpuScore: cpu * 10, history: [...g.history, rec], last: rec, over};
}
export function marblesAdvice(g) {
  if (roleOf(g) === 'guess') {
    const seen = g.history.filter((h) => h.role === 'guess').map((h) => parity(h.hidden));
    const fav = g.oddBias > 0.5 ? 'odd' : 'even';
    return {guess: fav, note: `AI는 지금까지 홀 ${seen.filter((p) => p === 'odd').length}번, 짝 ${seen.filter((p) => p === 'even').length}번 숨겼어요. 사실 AI는 '${PARITY_KO[fav]}'을 더 자주 쥐는 버릇이 있어요!`};
  }
  const mine = g.history.filter((h) => h.role === 'hide').map((h) => parity(h.hidden));
  const odd = mine.filter((p) => p === 'odd').length, even = mine.length - odd;
  const pick = odd > even ? 'even' : odd < even ? 'odd' : null;
  return {hideParity: pick, note: pick ? `내가 ${PARITY_KO[pick === 'odd' ? 'even' : 'odd']}을 더 많이 쥐었어요. AI가 눈치챘을 수 있으니 이번엔 ${PARITY_KO[pick]}로 가 보세요.` : 'AI가 아직 내 버릇을 몰라요. 아무거나 섞어서 쥐세요. 쥔 개수가 아니라 홀·짝만 중요해요.'};
}
