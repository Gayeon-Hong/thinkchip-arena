// Deploys the real-time room server (live-server/) to Cloudflare Workers (free plan),
// writes its address into src/live.config.js, then republishes the web version so the address is baked in.
import {spawnSync} from 'node:child_process';
import {writeFileSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = (msg) => { console.error(`\n❌ ${msg}`); process.exit(1); };

// Run wrangler in the open (not piped) so its login link/browser prompt is always visible,
// and read the deployed address from wrangler's machine-readable output file.
const outFile = path.join(os.tmpdir(), `thinkchip-live-${Date.now()}.ndjson`);
console.log('1/3 실시간 서버(thinkchip-live)를 Cloudflare에 올리는 중…');
console.log('    로그인이 필요하면 브라우저가 열려요. 안 열리면 아래에 나오는 https://dash.cloudflare.com/oauth2/... 주소를 복사해서 브라우저에 붙여넣고 Allow를 눌러 주세요.\n');
const dep = spawnSync('npx --yes wrangler deploy', {shell: true, cwd: path.join(ROOT, 'live-server'), stdio: 'inherit', env: {...process.env, WRANGLER_OUTPUT_FILE_PATH: outFile}});
if (dep.status !== 0) die('서버 배포 실패. 이 창을 캡처해서 Claude에게 보내 주세요.');
let url = '';
try { url = (readFileSync(outFile, 'utf8').match(/https:\/\/thinkchip-live\.[a-z0-9-]+\.workers\.dev/i) || [''])[0]; } catch {}
if (!url) {
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  const ans = await new Promise((r) => rl.question('\n위 로그에 보이는 https://thinkchip-live.~~~.workers.dev 주소를 붙여넣고 Enter: ', r)); rl.close();
  url = (String(ans).match(/https:\/\/thinkchip-live\.[a-z0-9-]+\.workers\.dev/i) || [''])[0];
  if (!url) die('주소 형식이 맞지 않아요.');
}
const m = [url];
const wss = `${m[0].replace('https://', 'wss://')}/live`;

console.log(`\n2/3 게임에 서버 주소 넣는 중: ${wss}`);
const cfg = path.join(ROOT, 'src', 'live.config.js');
writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(/export const LIVE_URL = '.*';/, `export const LIVE_URL = '${wss}';`));
spawnSync('node scripts/build-demo.mjs', {shell: true, cwd: ROOT, stdio: 'inherit'});

console.log('\n3/3 웹 버전 다시 올리는 중…');
const web = spawnSync('node scripts/deploy-web.mjs', {shell: true, cwd: ROOT, stdio: 'inherit'});
if (web.status !== 0) die('웹 배포 실패. 로그를 캡처해서 보내 주세요.');
console.log(`\n✅ 실시간 대결 준비 완료!\n   게임 주소: https://thinkchip-arena.pages.dev  → 홈의 "⚡ 친구와 실시간 대결"\n   서버 확인: ${m[0]}/health\n   토스 앱에도 넣으려면 02_build_ait_windows.cmd 로 .ait 를 다시 만들어 올려 주세요.`);
