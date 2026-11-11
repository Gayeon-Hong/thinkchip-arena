// 소수결 — you + 8 AI players pick one of two sides each round; only the minority side scores. Read the bots' habits.
import {seededRandom, shuffle, byLevel} from '../util.js';
export const MI_BOTS = 8, MI_ROUNDS = 7, MI_POINT = 20, MI_WIN = 30;
export const TOPICS = [['짜장면', '짬뽕'], ['여름', '겨울'], ['산', '바다'], ['고양이', '강아지'], ['아침형', '저녁형'], ['탕수육 부먹', '찍먹'], ['콜라', '사이다'], ['버스', '지하철'], ['민트초코 좋아', '싫어'], ['라면 꼬들', '퍼진 면']];
const AVATARS = ['🦊', '🐻', '🐼', '🐯', '🐸', '🐵', '🐰', '🐱'];
const PERSONAS = ['stubborn', 'stubborn', 'alternate', 'chaser', 'follower', 'copycat', 'random', 'random'];
export const PERSONA_KO = {stubborn: '고집쟁이', alternate: '번갈아', chaser: '지난 승자 따라', follower: '다수 따라', copycat: '나 따라쟁이', random: '랜덤'};
export function createMinority(seed, difficulty = 'normal') {
  const r = seededRandom(`mi:${seed}`), personas = shuffle(PERSONAS, r), topics = shuffle(TOPICS, r).slice(0, MI_ROUNDS);
  const bots = personas.map((p, i) => ({id: i, avatar: AVATARS[i], persona: p, pref: r() < 0.5 ? 0 : 1, pts: 0}));
  const noise = byLevel(difficulty, [0.1, 0.15, 0.2, 0.26, 0.32]);
  return {seed, difficulty, noise, bots, topics, round: 0, history: [], score: 0, rank: null, over: false, last: null};
}
// What a bot would pick with no randomness (used both by the bots and the hint).
export function intent(bot, g) {
  const prev = g.history.at(-1), mine = prev?.picks?.[bot.id];
  switch (bot.persona) {
    case 'stubborn': return bot.pref;
    case 'alternate': return mine === undefined ? bot.pref : 1 - mine;
    case 'chaser': return prev && prev.minority !== null ? prev.minority : bot.pref;
    case 'follower': return prev ? (prev.count[0] >= prev.count[1] ? 0 : 1) : bot.pref;
    case 'copycat': return prev ? prev.me : bot.pref;
    default: return null; // random
  }
}
export function botPick(bot, g) {
  const r = seededRandom(`mip:${g.seed}:${g.round}:${bot.id}`), base = intent(bot, g);
  if (base === null) return r() < 0.5 ? 0 : 1;
  return r() < g.noise ? 1 - base : base;
}
export function playMinority(g, side) {
  if (g.over || ![0, 1].includes(side)) return g;
  const picks = {};
  for (const b of g.bots) picks[b.id] = botPick(b, g);
  const count = [0, 0]; count[side]++; for (const b of g.bots) count[picks[b.id]]++;
  const minority = count[0] === count[1] || !count[0] || !count[1] ? null : count[0] < count[1] ? 0 : 1;
  const bots = g.bots.map((b) => (minority !== null && picks[b.id] === minority ? {...b, pts: b.pts + MI_POINT} : b));
  const won = minority !== null && side === minority, round = g.round + 1, over = round >= MI_ROUNDS;
  let score = g.score + (won ? MI_POINT : 0), rank = null;
  if (over) { rank = 1 + bots.filter((b) => b.pts > score).length; if (rank === 1) score += MI_WIN; }
  const rec = {round: g.round, me: side, picks, count, minority, won};
  return {...g, bots, round, score, rank, history: [...g.history, rec], last: rec, over};
}
// AI 도 같은 9명 판에서 실제로 골라요: 다른 참가자 버릇을 읽는 정도가 난이도마다 달라요. rounds: AI 차례 화면용 기록
const BOT_READ = [0.35, 0.8, 1, 1, 1];
export function minorityBotRun(seed, difficulty = 'normal') {
  const r = seededRandom(`mibot:${seed}:${difficulty}`), read = byLevel(difficulty, BOT_READ);
  let g = createMinority(seed, difficulty);
  while (!g.over) { const adv = minorityAdvice(g); const side = adv.side !== null && r() < read ? adv.side : (r() < 0.5 ? 0 : 1); g = playMinority(g, side); }
  return {rounds: g.history.map((h) => ({topic: g.topics[h.round], me: h.me, count: h.count, minority: h.minority, won: h.won})), score: g.score, rank: g.rank};
}
export function minorityBotTarget(seed, difficulty = 'normal') { return minorityBotRun(seed, difficulty).score; }
export function minorityAdvice(g) {
  const c = [0, 0], unknown = [];
  for (const b of g.bots) { const s = intent(b, g); if (s === null) unknown.push(b); else c[s]++; }
  const [a, b] = g.topics[Math.min(g.round, g.topics.length - 1)];
  const pick = c[0] === c[1] ? null : c[0] < c[1] ? 0 : 1;
  return {side: pick, note: `예상: '${a}' ${c[0]}명 · '${b}' ${c[1]}명 · 예측 불가 ${unknown.length}명. ${pick === null ? '반반이에요. 감으로 가세요!' : `'${pick ? b : a}' 쪽이 소수일 확률이 높아요.`}`};
}
