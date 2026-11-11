// 마지막 한 개 — classic misère Nim (take 1~3; whoever takes the LAST stone loses). Best of 3 rounds vs AI.
import {seededRandom, byLevel} from '../util.js';
export const NIM_ROUNDS = 3, NIM_WIN = 30;
// 13~22 stones, never 4k+1: the player (who moves first) can always win with perfect play — pure skill, no bad luck.
function roundStart(seed, round) { const r = seededRandom(`nim:${seed}:${round}`); let n = 13 + (r() * 10 | 0); if ((n - 1) % 4 === 0) n += 1 + (r() * 3 | 0); return n; }
export function createNim(seed, difficulty='normal') {
  return {seed, difficulty, round:0, stones:roundStart(seed, 0), turn:0, score:0, cpuScore:0, wins:0, losses:0, over:false, last:null, log:[]};
}
export function nimCpuTake(g) {
  const r = seededRandom(`nimcpu:${g.seed}:${g.round}:${g.stones}:${g.turn}`);
  const perfect = (g.stones - 1) % 4; // leave 4k+1 stones for the opponent
  const skill = byLevel(g.difficulty, [.7, .82, .9, .96, 1]);
  if (perfect > 0 && r() < skill) return perfect;
  return Math.max(1, Math.min(3, g.stones, 1 + (r() * 3 | 0)));
}
function endRound(g, loser, log) {
  const wins = g.wins + (loser === 'cpu' ? 1 : 0), losses = g.losses + (loser === 'me' ? 1 : 0), round = g.round + 1;
  const over = round >= NIM_ROUNDS || wins >= 2 || losses >= 2;
  return {...g, wins, losses, round, score: wins * NIM_WIN, cpuScore: losses * NIM_WIN, over, stones: over ? 0 : roundStart(g.seed, round),
    last:{...log, roundEnd: loser === 'cpu' ? 'win' : 'lose'}, log:[]};
}
export function playNim(g, take) {
  if (g.over || ![1,2,3].includes(take) || take > g.stones) return g;
  let stones = g.stones - take, turn = g.turn + 1;
  const log = {mine: take, cpu: null};
  if (stones === 0) return endRound({...g, turn}, 'me', log); // I took the last stone -> I lose the round
  const cpu = nimCpuTake({...g, stones, turn});
  stones -= cpu; log.cpu = cpu;
  if (stones === 0) return endRound({...g, turn}, 'cpu', log);
  return {...g, stones, turn, last: log, log:[...g.log, log]};
}
export function nimAdvice(g) {
  const best = (g.stones - 1) % 4;
  return best > 0 ? {take: best, note: `${best}개를 가져가 상대에게 ${g.stones - best}개(4의 배수+1)를 남기세요.`}
                  : {take: 1, note: '지금은 불리한 자리예요. 1개만 가져가고 상대의 실수를 기다리세요.'};
}
