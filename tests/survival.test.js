import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarbles,playMarbles,roleOf,cpuHide,parity,marblesAdvice,MB_ROUNDS} from '../src/games/marbles.js';
import {createRedLight,stepRedLight,phaseAt,RL_TIME} from '../src/games/redlight.js';
import {createBridge,playBridge,bridgeAdvice} from '../src/games/bridge.js';
import {createMinority,playMinority,minorityAdvice,MI_ROUNDS} from '../src/games/minority.js';

test('홀짝 구슬: 같은 시드 = 같은 AI 손, 구슬 총합 보존, 10판 종료', () => {
  assert.equal(cpuHide(createMarbles('q')), cpuHide(createMarbles('q')));
  let g = createMarbles('q');
  assert.equal(playMarbles(g, {guess: 'odd', bet: 0}), g); assert.equal(playMarbles(g, {guess: 'x', bet: 1}), g);
  while (!g.over) g = roleOf(g) === 'guess' ? playMarbles(g, {guess: 'odd', bet: 1}) : playMarbles(g, {hide: 1});
  assert.equal(g.me + g.cpu, 20); assert.ok(g.turn <= MB_ROUNDS); assert.equal(g.score, g.me * 10);
});
test('홀짝 구슬: 힌트대로 맞히면 AI 버릇을 이용할 수 있음', () => {
  let won = 0, tot = 0;
  for (let i = 0; i < 200; i++) { const g = createMarbles('s' + i); const h = marblesAdvice(g); tot++; if (parity(cpuHide(g)) === h.guess) won++; }
  assert.ok(won / tot > 0.6);
});
test('무궁화: 초록불에만 움직이면 완주, 계속 누르면 걸림, 안 누르면 시간초과', () => {
  let g = createRedLight('a');
  while (!g.over) g = stepRedLight(g, 16, phaseAt(g, g.t).type === 'green');
  assert.equal(g.finished, true); assert.ok(g.score > 100);
  let h = createRedLight('a'); while (!h.over) h = stepRedLight(h, 16, true);
  assert.equal(h.caught, true); assert.ok(h.score < 60);
  let k = createRedLight('a'); while (!k.over) k = stepRedLight(k, 50, false);
  assert.equal(k.timeout, true); assert.equal(k.score, 0); assert.ok(k.t >= RL_TIME);
});
test('징검다리: 완벽하면 만점, 틀리면 목숨 감소·같은 칸 재시도', () => {
  let g = createBridge('b');
  while (!g.over) g = playBridge(g, bridgeAdvice(g).side);
  assert.equal(g.score, (5 + 8 + 10) * 10 + 60 + 30);
  let m = createBridge('b', 'master'); assert.deepEqual(m.widths, [3, 3, 3]); while (!m.over) m = playBridge(m, bridgeAdvice(m).side); assert.equal(m.score, (7 + 10 + 13) * 10 + 60 + 20);
  let h = createBridge('b'); const wrong = 1 - h.stages[0][0];
  h = playBridge(h, wrong); assert.equal(h.lives, 2); assert.equal(h.step, 0);
  assert.equal(playBridge(h, wrong), h); h = playBridge(h, 1 - wrong); assert.equal(h.step, 1); assert.equal(h.score, 0);
});
test('소수결: 7판, 같은 선택 = 같은 결과, 힌트대로 하면 평균이 더 높음', () => {
  const run = (seed, f) => { let g = createMinority(seed); while (!g.over) g = playMinority(g, f(g)); return g; };
  assert.deepEqual(run('m', () => 0).history, run('m', () => 0).history);
  assert.equal(run('m', () => 0).round, MI_ROUNDS);
  let hint = 0, fixed = 0;
  for (let i = 0; i < 150; i++) { hint += run('t' + i, (g) => minorityAdvice(g).side ?? 0).score; fixed += run('t' + i, () => 0).score; }
  assert.ok(hint > fixed * 1.2, `${hint} vs ${fixed}`);
});

import {redLightBotTarget} from '../src/games/redlight.js';
import {createBlind, playBlind} from '../src/games/blind.js';
test('난이도: 무궁화 지옥에는 페이크가 있고, 쭉 누르면 결국 걸려요', () => {
  const g = createRedLight('x', 'master');
  assert.ok(g.phases.some((p) => p.fake));
  let h = g; while (!h.over) h = stepRedLight(h, 16, true); assert.equal(h.caught, true);
  let k = createRedLight('x', 'master'); while (!k.over) k = stepRedLight(k, 16, phaseAt(k, k.t).type === 'green'); assert.equal(k.finished, true);
});
test('난이도: 블라인드 AI는 높은 난이도에서 더 이겨요', () => {
  const run = (d) => { let w = 0; for (let i = 0; i < 120; i++) { let g = createBlind('b' + i, d); for (const v of [5, 6, 4, 7, 3, 8, 2, 9, 1]) g = playBlind(g, v); w += g.losses; } return w; };
  assert.ok(run('master') > run('easy'));
});
