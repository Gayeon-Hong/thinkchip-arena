import {seededRandom,shuffle} from '../util.js';
const DECK=Array.from({length:27},(_,id)=>({id,shape:id%3,color:Math.floor(id/3)%3,count:Math.floor(id/9)%3+1}));
export function isTrio(cards) {
 if(cards.length!==3)return false;
 return ['shape','color','count'].every(key=>{const values=new Set(cards.map(c=>c[key]));return values.size===1||values.size===3;});
}
export function trioSolutions(board) {
 const result=[];
 for(let a=0;a<board.length;a++)for(let b=a+1;b<board.length;b++)for(let c=b+1;c<board.length;c++)if(isTrio([board[a],board[b],board[c]]))result.push([a,b,c]);
 return result;
}
export function trioBoard(seed,round) {
 const rand=seededRandom(`trio:${seed}:${round}`);
 let board;
 for(let n=0;n<80;n++){board=shuffle(DECK,rand).slice(0,9);if(trioSolutions(board).length>=2)return board;}
 return board;
}
export function createTriad(seed) {return {seed,round:0,board:trioBoard(seed,0),selected:[],score:0,mistakes:0,solved:0,over:false,last:null};}
export function selectTriad(g,index) {
 if(g.over || !Number.isInteger(index) || index<0 || index>=9)return g;
 const selected=g.selected.includes(index)?g.selected.filter(i=>i!==index):[...g.selected,index];
 if(selected.length!==3)return {...g,selected,last:null};
 const valid=isTrio(selected.map(i=>g.board[i]));
 if(!valid){const cards=selected.map(i=>g.board[i]),why=['color','shape','count'].filter(k=>new Set(cards.map(c=>c[k])).size===2);return {...g,selected:[],mistakes:g.mistakes+1,score:Math.max(0,g.score-8),last:{valid:false,why,cards}};}
 const round=g.round+1,over=round===5;
 return {...g,selected:[],round,score:g.score+40,solved:g.solved+1,over,board:over?g.board:trioBoard(g.seed,round),last:{valid:true}};
}
export function skipTriad(g) {
 if(g.over)return g;
 const round=g.round+1,over=round===5;
 return {...g,selected:[],round,over,board:over?g.board:trioBoard(g.seed,round),last:{skip:true}};
}
export function trioAdvice(g) {return trioSolutions(g.board)[0]||[];}
export function triadBotTarget(seed,difficulty='normal') {
 const rng=seededRandom(`triadbot:${seed}:${difficulty}`);
 const l=['easy','normal','hard','expert','master'].indexOf(difficulty),missed=[1,1,0,0,0][l<0?1:l],slip=[3,2,3,2,1][l<0?1:l];
 return 200-(missed*40)-Math.floor(rng()*slip)*8;
}
