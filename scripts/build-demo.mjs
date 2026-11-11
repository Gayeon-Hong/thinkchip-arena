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
const html=`<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1"><meta name="theme-color" content="#101226"><title>씽크칩 아레나 - 두뇌게임</title><style>${css}</style></head><body><div id="app"></div><script type="module">${code.replaceAll('</script','<\\/script')}</script></body></html>`;
await writeFile(resolve(base,'PLAY_NOW.html'),html);
console.log('PLAY_NOW.html generated:',html.length,'characters');
