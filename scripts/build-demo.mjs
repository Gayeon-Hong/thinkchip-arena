import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const order=['app.config.js','src/util.js','src/catalog.js','src/games/flip.js','src/games/blind.js','src/games/triad.js','src/games/trust.js','src/games/baseball.js','src/games/nim.js','src/games/auction.js','src/games/geometry.js','src/games/maze.js','src/games/draw.js','src/games/marbles.js','src/games/redlight.js','src/games/bridge.js','src/games/minority.js','src/games/dots.js','src/games/gomoku.js','src/games/stroop.js','src/games/merge.js','src/games/sudoku.js','src/live.config.js','src/live.js','src/wallet.js','src/theme.js','src/icons.js','src/toss.js','src/main.js'];
let code='';
for(const file of order){
 let source=await readFile(resolve(base,file),'utf8');
 source=source.replace(/^import .*?from .*?;\s*$/gm,'').replace(/^export (?=(?:const|function|async function|class|let)\b)/gm,'');
 code+=`\n// ==== ${file} ====\n${source}\n`;
}
const css=await readFile(resolve(base,'src/styles.css'),'utf8');
const html=`<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1"><meta name="theme-color" content="#101226"><meta name="description" content="3D 라운지에서 친구들과 모여 심리전·두뇌 퍼즐·파티 게임을 즐기는 씽크칩 아레나"><link rel="manifest" href="./manifest.webmanifest"><link rel="icon" type="image/png" href="./icons/favicon-48.png"><link rel="apple-touch-icon" href="./icons/apple-touch-icon.png"><title>씽크칩 아레나 - 두뇌게임</title><style>${css}</style></head><body><div id="app"></div><script type="module">${code.replaceAll('</script','<\\/script')}</script></body></html>`;
await writeFile(resolve(base,'PLAY_NOW.html'),html);
console.log('PLAY_NOW.html generated:',html.length,'characters');

// ── 3D 라운지: public/lounge 가 원본. 메인 앱의 게임 목록과 실시간 서버 주소를 config.js 로 넘겨줘요. ──
import {cp, rm, mkdir} from 'node:fs/promises';
const {GAMES, PARTY_GAMES} = await import(new URL('../src/catalog.js', import.meta.url));
const {LIVE_URL} = await import(new URL('../src/live.config.js', import.meta.url));
const pick = (g) => ({id: g.id, title: g.title, short: g.short, genre: g.genre, symbol: g.symbol, color: g.color, ...(g.coop ? {coop: true} : {}), ...(g.min ? {min: g.min} : {})});
const config = `// 자동 생성 파일 (scripts/build-demo.mjs) — 직접 고치지 말고 src/catalog.js, src/live.config.js 를 고치세요.\nwindow.THINKCHIP_CONFIG = ${JSON.stringify({LIVE_URL, GAMES: GAMES.map(pick), PARTY: Object.values(PARTY_GAMES).map(pick)})};\n`;
await writeFile(resolve(base, 'public/lounge/config.js'), config);
// GitHub Pages 는 저장소 루트를 그대로 보여 줘요: 루트 index.html = PLAY_NOW, public/ 의 정적 파일을 루트에도 복사.
await writeFile(resolve(base, 'index.html'), html);
for (const dir of ['lounge', 'vendor', 'icons', 'screenshots']) {
  await rm(resolve(base, dir), {recursive: true, force: true});
  await mkdir(resolve(base, dir), {recursive: true});
  await cp(resolve(base, 'public', dir), resolve(base, dir), {recursive: true});
}
for (const f of ['manifest.webmanifest', 'privacy.html', 'sw.js']) await cp(resolve(base, 'public', f), resolve(base, f));
console.log('lounge/config.js + GitHub Pages 루트 미러 (index.html, lounge/, vendor/, icons/) 갱신');
