// 칩 경매 — sealed-bid auction psychology. 5 items, 30 coins each; higher secret bid wins the item.
import {seededRandom, shuffle, byLevel, lvl} from '../util.js';
export const AUC_ROUNDS = 5, AUC_COINS = 30;
const ITEMS = [{name:'금화', icon:'🪙', value:8},{name:'보석', icon:'💎', value:10},{name:'왕관', icon:'👑', value:12},{name:'열쇠', icon:'🗝️', value:6},
  {name:'두루마리', icon:'📜', value:4},{name:'저주받은 상자', icon:'🧨', value:-5},{name:'트로피', icon:'🏆', value:9},{name:'나침반', icon:'🧭', value:5}];
export function createAuction(seed, difficulty='normal') {
  const r = seededRandom(`auction:${seed}`);
  const lots = shuffle(ITEMS, r).slice(0, AUC_ROUNDS);
  return {seed, difficulty, lots, turn:0, coins:AUC_COINS, cpuCoins:AUC_COINS, score:0, cpuScore:0, myItems:[], cpuItems:[], over:false, last:null};
}
export function auctionCpuBid(g) {
  const lot = g.lots[g.turn], r = seededRandom(`auccpu:${g.seed}:${g.difficulty}:${g.turn}`);
  if (lot.value <= 0) return 0;
  const left = AUC_ROUNDS - g.turn, fair = g.cpuCoins / left;
  const greed = byLevel(g.difficulty, [1.15, 1.3, 1.45, 1.55, 1.65]);
  let bid = Math.round(fair * (lot.value / 8) * greed * (0.7 + r() * 0.6));
  // 고수+: knows how many coins you have left and outbids a likely all-in on the best lots
  if (lvl(g.difficulty) >= 3 && lot.value >= 10 && g.coins < g.cpuCoins) bid = Math.max(bid, Math.min(g.cpuCoins, g.coins + 1));
  return Math.max(0, Math.min(g.cpuCoins, bid));
}
export function playAuction(g, bid) {
  bid = Math.trunc(Number(bid));
  if (g.over || !Number.isFinite(bid) || bid < 0 || bid > g.coins) return g;
  const lot = g.lots[g.turn], cpu = auctionCpuBid(g);
  const winner = bid > cpu ? 'me' : cpu > bid ? 'cpu' : 'none'; // tie: nobody gets it, both pay
  const coins = g.coins - bid, cpuCoins = g.cpuCoins - cpu, turn = g.turn + 1;
  const myItems = winner === 'me' ? [...g.myItems, lot] : g.myItems, cpuItems = winner === 'cpu' ? [...g.cpuItems, lot] : g.cpuItems;
  const pts = (items) => items.reduce((a, x) => a + x.value, 0) * 10;
  const over = turn >= AUC_ROUNDS;
  // Leftover coins are worth 1 point each at the end (spending everything isn't free).
  const score = pts(myItems) + (over ? coins : 0), cpuScore = pts(cpuItems) + (over ? cpuCoins : 0);
  return {...g, turn, coins, cpuCoins, myItems, cpuItems, score, cpuScore, over, last:{lot, mine:bid, cpu, winner}};
}
export function auctionAdvice(g) {
  const lot = g.lots[g.turn], guess = auctionCpuBid(g);
  if (lot.value <= 0) return {bid:0, note:`${lot.name}은(는) ${lot.value * 10}점짜리 함정이에요. 0칩으로 넘기세요.`};
  // Paid hint gives a range, not the exact bid — keeps the mind game alive.
  const lo = Math.max(0, guess - 2 - (guess % 3)), hi = Math.min(g.cpuCoins, lo + 5);
  return {bid: Math.min(g.coins, hi + 1), note:`AI는 ${lo}~${hi}칩 사이를 걸 것 같아요. 남은 칩: AI ${g.cpuCoins}칩.`};
}
