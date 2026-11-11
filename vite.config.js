import {defineConfig} from 'vite';
import {appendFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';

// 토스 앱(.ait) 빌드에서는 라운지에 TOSS 표시를 남겨요 → 칩 선물 기능을 숨겨요.
// 웹/MS Store 빌드는 VITE_TARGET=web 으로 빌드해요 (scripts/deploy-web.mjs, .github/workflows/deploy-web.yml).
const tossLounge = () => ({
  name: 'thinkchip-toss-lounge',
  apply: 'build',
  closeBundle() {
    if (process.env.VITE_TARGET === 'web') return;
    const f = resolve('dist/lounge/config.js');
    if (existsSync(f)) appendFileSync(f, 'window.THINKCHIP_CONFIG.TOSS = true;\n');
  },
});

export default defineConfig({base: './', build: {outDir: 'dist', sourcemap: false}, plugins: [tossLounge()]});
