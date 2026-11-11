import {seedHash,seededRandom,byLevel} from '../util.js';
export function createTrust(seed,difficulty='normal') {
 const style=['mirror','cautious','greedy'][seedHash(`trust:${seed}:${difficulty}`)%3];
 return {seed,difficulty,style,turn:0,score:0,cpuScore:0,history:[],over:false,last:null};
}
export function trustCpuChoice(g) {
 const rand=seededRandom(`trust:${g.seed}:${g.difficulty}:${g.turn}`);
 if(g.turn===0)return g.style==='greedy'?'betray':'cooperate';
 if(g.style==='mirror')return g.history.at(-1).mine;
 if(g.style==='greedy')return rand()<byLevel(g.difficulty,[.65,.75,.85,.9,.95])?'betray':'cooperate';
 if(g.style==='mirror'&&g.turn===5&&rand()<byLevel(g.difficulty,[0,.3,.6,.85,1]))return 'betray'; // 마지막 판 뒤통수
 return g.history.filter(x=>x.mine==='betray').length>=byLevel(g.difficulty,[2,2,1,1,1])?'betray':rand()>byLevel(g.difficulty,[.2,.25,.3,.35,.4])?'cooperate':'betray';
}
export function playTrust(g,choice) {
 if(g.over || !['cooperate','betray'].includes(choice))return g;
 const cpu=trustCpuChoice(g);
 const rewards=choice==='cooperate'?(cpu==='cooperate'?[3,3]:[0,5]):(cpu==='cooperate'?[5,0]:[1,1]);
 const turn=g.turn+1;
 return {...g,turn,score:g.score+rewards[0],cpuScore:g.cpuScore+rewards[1],history:[...g.history,{mine:choice,cpu,mineScore:rewards[0],cpuScore:rewards[1]}],over:turn===6,last:{mine:choice,cpu,earned:rewards[0]}};
}
export function trustAdvice(g) {const choice=trustCpuChoice(g);return {choice,note:`AI의 다음 선택은 '${choice==='cooperate'?'협력':'배신'}'으로 예상돼요.`};}
