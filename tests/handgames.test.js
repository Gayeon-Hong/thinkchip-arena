import test from 'node:test';
import assert from 'node:assert/strict';
import {createMaze,playMaze,judgeTrace,mazeBotTarget,MAZE_STAGES} from '../src/games/maze.js';
import {createDraw,playDraw,scoreStroke,shapeOf,drawBotTarget,DRAW_ROUNDS} from '../src/games/draw.js';
import {resample} from '../src/games/geometry.js';

const centerTrace = (st) => resample(st.points, 80).map((p, i) => [p[0], p[1], i * 40]);

test('닿지 마!: 같은 시드 = 같은 길, 가운데 따라가면 통과', () => {
  assert.deepEqual(createMaze('s1').stages, createMaze('s1').stages);
  const g = createMaze('s1');
  for (const st of g.stages) assert.equal(judgeTrace(st, centerTrace(st)).ok, true);
});
test('닿지 마!: 벽 닿기·출발점 밖·중간에 떼기는 0점', () => {
  const st = createMaze('s2').stages[0], t = centerTrace(st);
  assert.equal(judgeTrace(st, [...t.slice(0, 10), [295, 5, 999]]).reason, 'touch');
  assert.equal(judgeTrace(st, [[290, 400, 0], ...t]).reason, 'start');
  assert.equal(judgeTrace(st, t.slice(0, 20)).reason, 'lift');
});
test('닿지 마!: 5단계 진행·속도 보너스·봇 목표 범위', () => {
  let g = createMaze('s3');
  for (let i = 0; i < MAZE_STAGES; i++) g = playMaze(g, centerTrace(g.stages[g.turn]));
  assert.equal(g.over, true); assert.equal(MAZE_STAGES, 5); assert.ok(g.score >= 200 && g.score <= 300);
  assert.ok(mazeBotTarget('a', 'easy') < mazeBotTarget('a', 'hard'));
});
test('그대로 그리기: 정확히 그리면 100, 크게 빗나가면 낮음, 반만 그리면 감점', () => {
  const pts = shapeOf('heart').pts;
  assert.equal(scoreStroke('heart', [...pts, pts[0]]), 100);
  assert.ok(scoreStroke('circle', shapeOf('circle').pts.map(([x, y]) => [150 + (x - 150) * 1.4, 150 + (y - 150) * 1.4])) < 40);
  assert.ok(scoreStroke('chip', resample([...shapeOf('chip').pts, shapeOf('chip').pts[0]], 60).slice(0, 30)) < 75);
  assert.equal(scoreStroke('heart', [[1, 1]]), 0);
});
test('그대로 그리기: 시드 고정 순서, 5라운드 종료', () => {
  assert.deepEqual(createDraw('z').order, createDraw('z').order);
  let g = createDraw('z');
  for (let i = 0; i < DRAW_ROUNDS; i++) { const p = shapeOf(g.order[g.turn]).pts; g = playDraw(g, [...p, p[0]]); }
  assert.equal(g.over, true); assert.equal(g.score, 500);
  assert.ok(drawBotTarget('a', 'master') <= 460);
});

import {mazeStageSize} from '../src/games/maze.js';
import {drawTolerance} from '../src/games/draw.js';
test('난이도: 닿지 마!는 단계마다 길이 좁아지고 내 점이 커져요', () => {
  for (const d of ['easy', 'normal', 'hard', 'expert', 'master']) {
    const a = mazeStageSize(d, 0), b = mazeStageSize(d, 4);
    assert.ok(b.clear <= a.clear && b.dot > a.dot, d);
    assert.ok(b.clear >= 4.5);
  }
  assert.ok(mazeStageSize('master', 0).clear < mazeStageSize('easy', 0).clear);
  assert.ok(drawTolerance('master', 4) < drawTolerance('easy', 0));
});
