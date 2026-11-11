import {seededRandom, shuffle} from '../util.js';
export const FLIP_LIMIT = 6;
export const FLIP_TOTAL = 36;
export const flipValue = n => 10 - n;
export function createFlip(seed) {
  const rng = seededRandom(`flip:${seed}`);
  const deck = shuffle(Array.from({length:36}, (_, i) => i % 9 + 1), rng);
  return {seed, deck, lanes:[[],[],[],[]], turn:0, score:0, streak:0, matches:0, flipsUsed:0, over:false, last:null};
}
export function bestMatch(lane) {
  const matches=[];
  for(let a=0;a<lane.length;a++) for(let b=a+1;b<lane.length;b++) for(let c=b+1;c<lane.length;c++) {
    const nums=[lane[a],lane[b],lane[c]];
    if(nums[0]===nums[1]&&nums[1]===nums[2]) matches.push({indexes:[a,b,c],points:30,kind:'triple'});
    else { const s=[...nums].sort((x,y)=>x-y); if(s[0]+1===s[1]&&s[1]+1===s[2]) matches.push({indexes:[a,b,c],points:40,kind:'run'}); }
  }
  return matches.sort((a,b)=>b.points-a.points)[0] || null;
}
export function flipOptions(g) {
  if(g.over)return [];
  const raw=g.deck[g.turn], result=[];
  for(let lane=0;lane<4;lane++) {
    if(g.lanes[lane].length>=5)continue;
    for(const flipped of [false,true]) {
      if(flipped&&(g.flipsUsed>=FLIP_LIMIT||raw===5))continue;
      const value=flipped?flipValue(raw):raw;
      const preview=bestMatch([...g.lanes[lane],value]);
      result.push({lane,flipped,value,match:preview});
    }
  }
  return result;
}
export function playFlip(g, laneIndex, flipped=false) {
  const option=flipOptions(g).find(x=>x.lane===laneIndex&&x.flipped===flipped);
  if(!option)return g;
  const lanes=g.lanes.map(l=>[...l]),row=lanes[laneIndex]; row.push(option.value);
  let score=g.score, matches=g.matches, streak=g.streak, cleared=0, kind='';
  for(let match=bestMatch(row);match;match=bestMatch(row)) {
    streak=Math.min(3,streak+1); score+=match.points*streak; matches++;cleared++;kind=match.kind;
    for(const index of [...match.indexes].sort((a,b)=>b-a))row.splice(index,1);
  }
  if(!cleared)streak=0;
  const turn=g.turn+1;
  return {...g, lanes,turn,score,matches,streak,flipsUsed:g.flipsUsed+Number(flipped),over:turn>=g.deck.length||lanes.every(l=>l.length===5),last:{cleared,kind,earned:score-g.score,value:option.value,lane:laneIndex}};
}
export function flipAdvice(g) {
  const options=flipOptions(g);
  const ranked=options.map(o=>({ ...o, quality:(o.match?.points||0)*4 -(o.flipped?12:0) -g.lanes[o.lane].length*2+g.lanes[o.lane].filter(n=>Math.abs(n-o.value)<=2).length*4 }));
  ranked.sort((a,b)=>b.quality-a.quality||a.lane-b.lane);
  return ranked[0]||null;
}
export function simulateFlipBot(seed, difficulty='normal') {
  let g=createFlip(seed);
  const rand=seededRandom(`flipbot:${seed}:${difficulty}`);
  while(!g.over) {
    const options=flipOptions(g);if(!options.length)break;
    let chosen;
    const level=['easy','normal','hard','expert','master'].indexOf(difficulty);
    if(level>=2) {
      let highest=-Infinity;
      for(const o of options) {
        const next=playFlip(g,o.lane,o.flipped);
        const second=flipAdvice(next);
        const val=next.score-g.score + (second?.match?.points||0)*0.9 - (o.flipped?6:0) - next.lanes[o.lane].length*1.3;
        if(val>highest){highest=val;chosen=o;}
      }
    } else {
      chosen=flipAdvice(g);
      if(rand()<(difficulty==='easy'?.19:.08))chosen=options[Math.floor(rand()*options.length)];
    }
    g=playFlip(g,chosen.lane,chosen.flipped);
  }
  const boost={expert:1.08,master:1.16}[difficulty]||1; // 고수·지옥: AI keeps a few points of tempo on you
  return Math.round(g.score*boost);
}
