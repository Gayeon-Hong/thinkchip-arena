import test from 'node:test';
import assert from 'node:assert/strict';
import {createSudoku, playSudoku} from '../src/games/sudoku.js';
import {createMerge, playMerge, slide} from '../src/games/merge.js';
import {createStroop, playStroop} from '../src/games/stroop.js';
import {createGomoku, playGomoku, gomokuAI, GM_N} from '../src/games/gomoku.js';
import {createDots, playDots, dotsAI, DB_LINES as LINES} from '../src/games/dots.js';

test('스도쿠: 같은 시드 = 같은 퍼즐, 정답이면 끝까지 풀림, 틀리면 실수', () => {
  assert.deepEqual(createSudoku('a').board, createSudoku('a').board);
  let g = createSudoku('a', 'hard'); assert.ok(g.givens.filter(Boolean).length <= 30);
  const i0 = g.board.indexOf(0), wrong = (g.solution[i0] % 9) + 1;
  g = playSudoku(g, i0, wrong, 1000); assert.equal(g.mistakes, 1); assert.equal(g.board[i0], 0);
  let i; while (!g.over) { i = g.board.indexOf(0); g = playSudoku(g, i, g.solution[i], 60000); }
  assert.equal(g.solved, true); assert.equal(g.score, 1000 - 60);
});
test('숫자 합치기: 같은 숫자가 합쳐지고, 같은 시드는 같은 타일', () => {
  const s = slide([2, 2, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'left');
  assert.deepEqual(s.board.slice(0, 4), [4, 8, 0, 0]); assert.equal(s.gain, 12);
  const a = playMerge(createMerge('z'), 'left'), b = playMerge(createMerge('z'), 'left'); assert.deepEqual(a.board, b.board);
});
test('색깔 맞히기: 정답 콤보 보너스, 오답 감점', () => {
  let g = createStroop('q'); const it = g.items[0];
  g = playStroop(g, it.ask === 'ink' ? it.ink : it.word); assert.equal(g.score, 10);
  const it2 = g.items[1]; g = playStroop(g, it2.ask === 'ink' ? it2.ink : it2.word); assert.equal(g.score, 21);
  g = playStroop(g, 'nope'); assert.equal(g.score, 6); assert.equal(g.combo, 0);
});
test('오목: 다섯 줄이면 승리, AI는 막아요', () => {
  let g = createGomoku('x');
  for (const [a, b] of [[0, 20], [1, 21], [2, 22], [3, 23]]) { g = playGomoku(g, a); g = playGomoku(g, b); }
  g = playGomoku(g, 4); assert.equal(g.winner, 0); assert.ok(g.score > 100);
  let h = createGomoku('y', 'normal'); for (const i of [0, 30, 1, 31, 2, 32, 3]) h = playGomoku(h, i);
  assert.equal(gomokuAI(h), 4); // AI (white) must block the four
});
test('땅따먹기: 상자를 닫으면 점수 + 한 번 더, 끝나면 승패', () => {
  let g = createDots('d');
  for (const li of [0, 20, 21]) g = playDots(g, li); // three sides of box 0 (top, left, right)
  assert.equal(g.pts[0] + g.pts[1], 0);
  const who = g.toMove; g = playDots(g, 4); // bottom side closes box 0
  assert.equal(g.pts[who], 1); assert.equal(g.toMove, who);
  let k = createDots('e', 'hard'); while (!k.over) k = playDots(k, dotsAI(k)); assert.equal(k.pts[0] + k.pts[1], 16); assert.equal(k.lines.length, LINES);
});
