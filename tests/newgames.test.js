import test from 'node:test';
import assert from 'node:assert/strict';
import {createBaseball,playBaseball,judge,candidates,baseballAdvice,baseballBotTarget,BB_TRIES} from '../src/games/baseball.js';
import {createNim,playNim,nimAdvice} from '../src/games/nim.js';
import {createAuction,playAuction,AUC_COINS} from '../src/games/auction.js';

test('숫자 탐정: 스트라이크/볼 판정', () => {
  assert.deepEqual(judge([1,2,3],[1,2,3]),{strike:3,ball:0});
  assert.deepEqual(judge([1,2,3],[3,1,2]),{strike:0,ball:3});
  assert.deepEqual(judge([1,2,3],[1,5,2]),{strike:1,ball:1});
});
test('숫자 탐정: 같은 시드 = 같은 정답 (친구 도전 공정성), 잘못된 입력 무시', () => {
  assert.deepEqual(createBaseball('abc').secret, createBaseball('abc').secret);
  const g=createBaseball('abc'); assert.equal(playBaseball(g,[1,1,2]),g); assert.equal(playBaseball(g,[0,1,2]),g);
});
test('숫자 탐정: 정답 맞히면 종료·점수, 8번 실패면 0점', () => {
  let g=createBaseball('x'); g=playBaseball(g,g.secret); assert.equal(g.solved,true); assert.equal(g.score,100); assert.equal(g.over,true);
  let h=createBaseball('y'); const wrong=[1,2,3].every((d,i)=>h.secret[i]===d)?[4,5,6]:[1,2,3];
  for(let i=0;i<BB_TRIES;i++) h=playBaseball(h, judge(h.secret,wrong).strike===3?[7,8,9]:wrong);
  assert.equal(h.over,true); assert.equal(h.score,0);
});
test('숫자 탐정: 후보 추론과 AI 목표점수', () => {
  const g=playBaseball(createBaseball('z'),[1,2,3]);
  assert.ok(candidates(g.history).some(c=>c.join()===g.secret.join()));
  assert.ok(baseballAdvice(g).guess.length===3);
  const t=baseballBotTarget('z','hard'); assert.ok(t>=0 && t<=100);
});
test('마지막 한 개: 완벽하게 두면 항상 이김 (운이 아닌 실력 게임)', () => {
  for(let i=0;i<50;i++){ let g=createNim('n'+i,'hard'),k=0; while(!g.over&&k++<100) g=playNim(g,nimAdvice(g).take); assert.ok(g.wins>g.losses,'seed n'+i); }
});
test('마지막 한 개: 잘못된 수는 무시', () => {
  const g=createNim('q'); assert.equal(playNim(g,0),g); assert.equal(playNim(g,4),g);
});
test('칩 경매: 칩 범위 검증, 5라운드 후 종료, 점수 = 보물×10 + 남은 칩', () => {
  let g=createAuction('a1','normal'); assert.equal(playAuction(g,AUC_COINS+1),g); assert.equal(playAuction(g,-1),g);
  for(let i=0;i<5;i++) g=playAuction(g,0);
  assert.equal(g.over,true); assert.equal(g.score, g.myItems.reduce((a,x)=>a+x.value,0)*10 + g.coins);
});
