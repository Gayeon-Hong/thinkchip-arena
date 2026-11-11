export function seedHash(value) {
  let h = 2166136261;
  for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function seededRandom(seed) {
  let t = seedHash(seed) || 1;
  return () => { t = (t + 0x6D2B79F5) | 0; let x = Math.imul(t ^ t >>> 15, 1 | t); x ^= x + Math.imul(x ^ x >>> 7, 61 | x); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(items, rand) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export function newSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const raw = new Uint32Array(2); crypto.getRandomValues(raw);
    return [...raw].map(n => n.toString(36)).join('-');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
export function fmt(n) { return Number(n || 0).toLocaleString('ko-KR'); }
export function clamp(x,min,max) { return Math.max(min,Math.min(max,x)); }
// 5 difficulty steps. Every engine indexes its tuning tables with lvl(): 쉬움 0 · 보통 1 · 어려움 2 · 고수 3 · 지옥 4.
export const LEVELS = ['easy', 'normal', 'hard', 'expert', 'master'];
export const LEVEL_KO = {easy: '쉬움', normal: '보통', hard: '어려움', expert: '고수', master: '지옥'};
export const lvl = (d) => { const i = LEVELS.indexOf(d); return i < 0 ? 1 : i; };
export const byLevel = (d, table) => table[lvl(d)];
