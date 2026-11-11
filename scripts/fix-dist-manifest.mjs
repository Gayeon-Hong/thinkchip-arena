// vite 가 index.html 의 manifest 를 assets/manifest-xxxx.webmanifest 로 옮기면서
// GitHub Pages 용(상대경로) 사본을 가져가 버려요. 빌드 뒤 dist 의 링크를 public/manifest(사이트 루트 기준)로 되돌려요.
import {readFile, writeFile, readdir, rm, copyFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), dist = resolve(root, 'dist');
const file = resolve(dist, 'index.html');
let html = await readFile(file, 'utf8');
html = html.replace(/href="[^"]*manifest[^"]*\.webmanifest"/, 'href="./manifest.webmanifest"');
await writeFile(file, html);
await copyFile(resolve(root, 'public/manifest.webmanifest'), resolve(dist, 'manifest.webmanifest'));
for (const f of await readdir(resolve(dist, 'assets')).catch(() => [])) if (/^manifest-.*\.webmanifest$/.test(f)) await rm(resolve(dist, 'assets', f));
console.log('dist manifest → ./manifest.webmanifest (사이트 루트 기준 경로)');
