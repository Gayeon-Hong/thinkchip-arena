// 심리전 AI 의 '한마디': 매 판 시작할 때 AI 가 속마음을 말하는데, 진짜일 때도 있고 블러핑일 때도 있어요.
// 같은 판(seed+turn)이면 늘 같은 말 (다시 그려도 안 바뀌어요). 난이도가 높을수록, 욕심 많은 AI 일수록 더 자주 속여요.
import {seededRandom, lvl} from '../util.js';
import {trustCpuChoice} from './trust.js';
import {roleOf, cpuHide, cpuGuess, parity, PARITY_KO} from './marbles.js';
import {auctionCpuBid, AUC_ROUNDS} from './auction.js';
import {blindCpuCard} from './blind.js';

const BF_HONEST = [0.8, 0.7, 0.6, 0.52, 0.45];
const bfPick = (r, a) => a[Math.floor(r() * a.length)];
export const BLUFF_GAMES = ['trust', 'marbles', 'auction', 'blind'];
const bfTurn = (id, g) => g.turn;

// 이번 판 AI 의 한마디: {text, truth: true(진심)|false(블러핑)|null(애매)}
export function aiTell(id, g) {
  if (!BLUFF_GAMES.includes(id) || !g || g.over) return null;
  const r = seededRandom(`tell:${id}:${g.seed}:${g.difficulty}:${bfTurn(id, g)}`), L = lvl(g.difficulty);
  let honest = BF_HONEST[L];
  if (r() < 0.15) return {text: bfPick(r, ['글쎄~ 나도 아직 몰라 😏', '내 표정 읽어 봐 😐', '맞혀 보시던가 ㅋㅋ', '…🤐']), truth: null};
  if (id === 'trust') {
    if (g.style === 'greedy') honest -= 0.25; else if (g.style === 'mirror') honest += 0.1;
    const real = trustCpuChoice(g), truth = r() < honest, say = truth ? real : real === 'cooperate' ? 'betray' : 'cooperate';
    return {truth, text: say === 'cooperate' ? bfPick(r, ['이번엔 협력할게 🤝 믿어 봐', '우리 같이 살자 🙏', '나 배신 안 해. 진짜로 😇']) : bfPick(r, ['이번엔 배신이다 😈', '미안 ㅋㅋ 이번엔 내가 먹는다', '협력? 그런 거 몰라 😏'])};
  }
  if (id === 'marbles') {
    if (roleOf(g) === 'guess') { // AI 가 숨김 → 내가 맞혀야 해요
      const real = parity(cpuHide(g)), truth = r() < honest, say = truth ? real : real === 'odd' ? 'even' : 'odd';
      return {truth, text: bfPick(r, [`이번엔 ${PARITY_KO[say]}이야. 진짜임 😐`, `${PARITY_KO[say]} 쥐었는데… 믿을래? 😏`, `힌트 줄까? ${PARITY_KO[say]} ✊`])};
    }
    const real = cpuGuess(g).guess, truth = r() < honest, say = truth ? real : real === 'odd' ? 'even' : 'odd'; // 내가 숨김 → AI 가 떠봐요
    return {truth, text: bfPick(r, [`너 ${PARITY_KO[say]} 쥘 거잖아 👀 다 보여`, `난 ${PARITY_KO[say]}에 건다 😎`, `이번엔 ${PARITY_KO[say]} 찍을 거야~`])};
  }
  if (id === 'auction') {
    const lot = g.lots[g.turn], bid = auctionCpuBid(g), fair = g.cpuCoins / Math.max(1, AUC_ROUNDS - g.turn);
    const realHigh = bid >= Math.max(3, fair), truth = r() < honest, sayHigh = truth ? realHigh : !realHigh;
    if (lot.value <= 0 && !truth) return {truth: false, text: bfPick(r, [`오 ${lot.icon} 이거 탐나는데? 😍`, '이건 내가 가져간다 💰'])}; // 함정 상자로 꼬시기
    return {truth, text: sayHigh ? bfPick(r, [`${lot.icon} 이건 꼭 가져간다 💰`, '올인할 수도 있음 🔥', '이번엔 세게 간다 😤']) : bfPick(r, [`${lot.icon}? 별로 관심 없는데~ 🥱`, '이번엔 쉬어 갈래 😴', '조금만 걸 거야 ㅎㅎ'])};
  }
  if (id === 'blind') {
    const real = blindCpuCard(g), realHigh = real >= 6, truth = r() < honest, sayHigh = truth ? realHigh : !realHigh;
    return {truth, text: sayHigh ? bfPick(r, ['큰 거 낸다 🔥', '이번 판은 내가 먹는다 😤', '높은 숫자 각오해 😏']) : bfPick(r, ['작은 거 낼게~ 😇', '이번 판은 버릴래 ㅎㅎ', '아껴 둘 거야 🤫'])};
  }
  return null;
}
// 판이 끝난 뒤 AI 반응: 방금 한마디가 블러핑이었는지에 따라 놀리거나 아쉬워해요
export function aiTellReact(prevTell, iWonRound, seedKey) {
  if (!prevTell) return null;
  const r = seededRandom(`tellr:${seedKey}`);
  if (prevTell.truth === false) return iWonRound ? bfPick(r, ['어? 안 넘어오네 🤔', '블러핑 들켰다 ㅋㅋ', '눈치 빠르네… 😮']) : bfPick(r, ['속았지? 😏 ㅋㅋㅋ', '블러핑이었는데~ 😎', '내 말을 믿다니 ㅋㅋ']);
  if (prevTell.truth === true) return iWonRound ? bfPick(r, ['진짜였는데 피했네 😭', '말해 줬는데도 지다니 ㅠ']) : bfPick(r, ['말했잖아 진짜라고 😐', '난 거짓말 안 해 😇']);
  return iWonRound ? bfPick(r, ['흠… 🤔', '이번 판은 줬다 ㅠ']) : bfPick(r, ['훗 😏', '읽혔지?']);
}
