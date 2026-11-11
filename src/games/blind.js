import {seededRandom, shuffle, byLevel} from '../util.js';
export function createBlind(seed,difficulty='normal') {
 const r=seededRandom(`blind:${seed}:${difficulty}`);
 const order=shuffle([1,2,3,4,5,6,7,8,9],r);
 return {seed,difficulty,turn:0,remaining:[1,2,3,4,5,6,7,8,9],cpuLeft:[1,2,3,4,5,6,7,8,9],cpuOrder:order,history:[],wins:0,losses:0,ties:0,score:0,cpuScore:0,over:false,last:null};
}
// 쉬움: the shuffled order only. Higher levels: the AI sometimes "reads your face" — it plays the smallest
// card that beats yours (or dumps its lowest if it can't). Deterministic per seed+turn, so challenges stay fair.
export function blindCpuCard(g,value) {
 const left=g.cpuLeft||g.cpuOrder.slice(g.turn),fallback=g.cpuOrder.find(c=>left.includes(c));
 const r=seededRandom(`blindcpu:${g.seed}:${g.turn}`);
 if(value===undefined||r()>=byLevel(g.difficulty,[0,.12,.2,.28,.36]))return fallback;
 const sorted=[...left].sort((a,b)=>a-b),beat=sorted.find(c=>c>value);
 return beat??sorted[0];
}
export function playBlind(g,value) {
 if(g.over || !g.remaining.includes(value))return g;
 const cpu=blindCpuCard(g,value),outcome=value>cpu?'win':value===cpu?'tie':'lose';
 const score=g.score+(outcome==='win'?20:outcome==='tie'?8:0);
 const cpuScore=g.cpuScore+(outcome==='lose'?20:outcome==='tie'?8:0);
 const turn=g.turn+1;
 return {...g, turn,remaining:g.remaining.filter(x=>x!==value),cpuLeft:(g.cpuLeft||g.cpuOrder.slice(g.turn)).filter(x=>x!==cpu), history:[...g.history,{mine:value,cpu,outcome}],wins:g.wins+Number(outcome==='win'),losses:g.losses+Number(outcome==='lose'),ties:g.ties+Number(outcome==='tie'),score,cpuScore,over:turn===9,last:{mine:value,cpu,outcome}};
}
export function blindAdvice(g) {
 const remainingCpu=g.cpuLeft||g.cpuOrder.slice(g.turn);
 const avg=remainingCpu.reduce((a,b)=>a+b,0)/remainingCpu.length;
 const choice=[...g.remaining].sort((a,b)=>Math.abs(a-(avg+1))-Math.abs(b-(avg+1)))[0];
 return {choice,note:`AI가 아직 쓰지 않은 카드의 평균은 ${avg.toFixed(1)} 근처일 수 있어요. ${choice}을(를) 고려해 보세요.`};
}
