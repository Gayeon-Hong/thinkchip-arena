// 색깔 맞히기 — Stroop test. A colour word is shown in a different ink. Answer the INK colour
// (or, at 어려움+, the rule flips between 글자색 and 글자 뜻). Timed; combo bonus.
import {seededRandom, byLevel, lvl} from '../util.js';
export const COLORS = [{id: 'red', name: '빨강', hex: '#ff4d5e'}, {id: 'blue', name: '파랑', hex: '#4d8bff'}, {id: 'green', name: '초록', hex: '#2fbf6b'}, {id: 'yellow', name: '노랑', hex: '#f5c21b'}, {id: 'purple', name: '보라', hex: '#a35cff'}];
export function createStroop(seed, difficulty = 'normal') {
  const l = lvl(difficulty), r = seededRandom(`stroop:${seed}`), nColors = [3, 4, 4, 5, 5][l], flip = [0, 0, 0.3, 0.4, 0.5][l];
  const items = Array.from({length: 240}, () => {
    const pool = COLORS.slice(0, nColors), word = (r() * nColors) | 0; let ink = (r() * nColors) | 0;
    if (r() < 0.8 && ink === word) ink = (ink + 1 + ((r() * (nColors - 1)) | 0)) % nColors; // mostly mismatched
    return {word: pool[word].id, ink: pool[ink].id, ask: r() < flip ? 'word' : 'ink'};
  });
  return {seed, difficulty, items, colors: COLORS.slice(0, nColors).map((c) => c.id), time: byLevel(difficulty, [40, 35, 30, 30, 25]) * 1000, idx: 0, combo: 0, right: 0, wrong: 0, score: 0, cpuScore: 0, over: false, last: null, turn: 0};
}
export function playStroop(g, answer) {
  if (g.over) return g;
  const it = g.items[g.idx], correct = answer === (it.ask === 'ink' ? it.ink : it.word);
  const combo = correct ? g.combo + 1 : 0, gain = correct ? 10 + Math.min(10, combo - 1) : -15;
  return {...g, idx: g.idx + 1, combo, right: g.right + (correct ? 1 : 0), wrong: g.wrong + (correct ? 0 : 1), score: Math.max(0, g.score + gain), last: {correct, gain}, turn: g.turn + 1, over: g.idx + 1 >= g.items.length};
}
export const endStroop = (g) => ({...g, over: true});
export function stroopBotTarget(seed, difficulty = 'normal') { const r = seededRandom(`stroopbot:${seed}`); return byLevel(difficulty, [600, 560, 430, 410, 370]) + Math.round(r() * 40); }
export const stroopAdvice = (g) => { const it = g.items[g.idx]; const ans = it.ask === 'ink' ? it.ink : it.word; return {answer: ans, note: `정답: ${COLORS.find((c) => c.id === ans).name}. 글자를 읽지 말고 ${it.ask === 'ink' ? '색만' : '뜻만'} 보세요!`}; };
