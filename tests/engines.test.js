import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlip,flipOptions,playFlip,flipValue,bestMatch,simulateFlipBot} from '../src/games/flip.js';
import {createBlind,playBlind} from '../src/games/blind.js';
import {createTriad,selectTriad,trioSolutions,isTrio,skipTriad} from '../src/games/triad.js';
import {createTrust,playTrust,trustCpuChoice} from '../src/games/trust.js';
import {defaultProfile,awardRun,spendChips,awardAd,AD_DAILY_LIMIT} from '../src/wallet.js';

test('뒤집어 3! 같은 seed는 타일 순서가 동일',()=>{
 const a=createFlip('case1'),b=createFlip('case1');
 assert.deepEqual(a.deck,b.deck);assert.equal(a.deck.length,36);
});
test('뒤집기 숫자 합은 10, 5는 자기 자신',()=>{
 for(let n=1;n<=9;n++)assert.equal(flipValue(n)+n,10);
});
test('동일 숫자 3개, 연속 숫자 3개를 판별',()=>{
 assert.equal(bestMatch([7,7,7]).points,30);assert.equal(bestMatch([5,3,4]).points,40);
 assert.equal(bestMatch([1,3,9]),null);
});
test('뒤집어 3! 한 턴에 유효한 곳에 넣고 AI가 정상 종료',()=>{
 const g=createFlip('ai-1');const options=flipOptions(g);assert.ok(options.length>0);
 const next=playFlip(g,options[0].lane,options[0].flipped);assert.equal(next.turn,1);assert.equal(g.turn,0);
 for(const diff of ['easy','normal','hard'])assert.ok(Number.isFinite(simulateFlipBot('ai-1',diff)));
});
test('블라인드 숫자 카드 한 번씩 사용',()=>{
 let g=createBlind('abc');g=playBlind(g,9);const previous=g;
 assert.equal(playBlind(g,9),previous);
 for(let n=1;n<=8;n++)g=playBlind(g,n);
 assert.equal(g.over,true);assert.equal(g.history.length,9);
});
test('3장의 법칙: 각 속성이 같거나 모두 다르면 조합',()=>{
 assert.ok(isTrio([{shape:0,color:0,count:1},{shape:1,color:1,count:2},{shape:2,color:2,count:3}]));
 assert.ok(!isTrio([{shape:0,color:0,count:1},{shape:0,color:1,count:1},{shape:1,color:2,count:1}]));
});
test('3장의 법칙: 5개 퍼즐 모두 해법이 존재하며 클리어',()=>{
 let g=createTriad('logic-seed');
 for(let i=0;i<5;i++){
  const [a,b,c]=trioSolutions(g.board)[0];assert.ok(a!==undefined);
  g=selectTriad(g,a);g=selectTriad(g,b);g=selectTriad(g,c);
 }
 assert.equal(g.score,200);assert.equal(g.over,true);
});
test('3장의 법칙: 건너뛰기하면 점수 없이 진행',()=>{
 let g=createTriad('skip');for(let i=0;i<5;i++)g=skipTriad(g);
 assert.equal(g.over,true);assert.equal(g.score,0);
});
test('믿을까 배신할까: AI가 유효한 행동을 내며 6라운드 종료',()=>{
 let g=createTrust('trust-001');
 for(let i=0;i<6;i++){assert.ok(['cooperate','betray'].includes(trustCpuChoice(g)));g=playTrust(g,i%2?'betray':'cooperate');}
 assert.equal(g.over,true);assert.equal(g.history.length,6);
});
test('보상: 동일 시드 중복 지급 없음, 1일 상한 100',()=>{
 let p=defaultProfile();const now=new Date('2026-11-06T11:10:00');
 const first=awardRun(p,'flip:seed:ai',25,now);assert.equal(first.earned,25);
 assert.equal(awardRun(first.profile,'flip:seed:ai',25,now).earned,0);
 p=first.profile;
 for(let i=0;i<5;i++)p=awardRun(p,`flip:seed${i}:ai`,25,now).profile;
 assert.equal(p.chips,200);
});
test('보상: 힌트 차감, 칩 부족, 광고 시청 횟수 제한',()=>{
 let p=defaultProfile();assert.equal(spendChips(p,30).profile.chips,70);
 assert.equal(spendChips(p,101).ok,false);
 for(let i=0;i<AD_DAILY_LIMIT;i++)p=awardAd(p,new Date('2026-11-06T09:00:00')).profile;
 assert.equal(awardAd(p,new Date('2026-11-06T09:00:00')).earned,0);
});
