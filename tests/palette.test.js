import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
function palette(theme) {
  const start = css.indexOf(`[data-theme="${theme}"]{`);
  assert.ok(start >= 0);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):([^;{}]+)/g)].map(m => [m[1], m[2]]));
}
function luminance(hex) {
  assert.match(hex, /^#[\da-f]{6}$/i);
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
for (const mode of ['dark', 'light']) {
  test(`Navy palette: readable text and controls in ${mode} mode`, () => {
    const p = palette(mode);
    for (const [fg, bg] of [['text','bg'],['muted','surface'],['subtle','bg'],
      ['accent-text','accent'],['accent-text','accent-hover'],['accent-ink','hero'],
      ['hero-muted','hero'],['art-front-text','art-front'],['art-back-text','art-back'],
      ['toast-text','toast-bg']]) {
      const ratio = contrast(p[fg], p[bg]);
      assert.ok(ratio >= 4.5, `${mode} ${fg}/${bg}: ${ratio.toFixed(2)}`);
    }
  });
}
test('Navy palette: lime brand colors removed from active stylesheet', () => {
  for (const color of ['#c3f96b','#d3ff91','#d4fb83','#bbeb75','#3f6919','#d3efaa']) {
    assert.equal(css.includes(color), false, color);
  }
});
test('Standalone preview includes current stylesheet and theme meta colors', () => {
  const html = readFileSync(new URL('../PLAY_NOW.html', import.meta.url), 'utf8');
  assert.ok(html.includes(`<style>${css}</style>`));
  assert.ok(html.includes('#0c1323'));
  assert.ok(html.includes('#f4f6fb'));
});
