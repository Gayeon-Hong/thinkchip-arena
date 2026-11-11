// Publishes the web version (for Microsoft Store / PWA) to Cloudflare Pages: https://thinkchip-arena.pages.dev
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, env = {}) => spawnSync(cmd, {shell: true, cwd: ROOT, stdio: 'inherit', env: {...process.env, ...env}}).status === 0;
const die = (m) => { console.error('\n[실패] ' + m); process.exit(1); };
console.log('==== [1/4] 패키지 설치 ===='); if (!existsSync(join(ROOT, 'node_modules', 'vite'))) { if (!run('npm install')) die('npm install 실패'); }
console.log('==== [2/4] 테스트 ===='); if (!run('npm test')) die('테스트 실패');
console.log('==== [3/4] 웹 버전 빌드 (토스 SDK 끔) ===='); if (!run('node scripts/build-demo.mjs')) die('라운지/데모 빌드 실패'); if (!run('npx vite build', {VITE_TARGET: 'web'})) die('빌드 실패');
console.log('==== [4/4] Cloudflare Pages 배포 ====');
spawnSync('npx --yes wrangler pages project create thinkchip-arena --production-branch main', {shell: true, cwd: ROOT, stdio: 'ignore'}); // ok if it already exists
if (!run('npx --yes wrangler pages deploy dist --project-name thinkchip-arena --branch main --commit-dirty=true')) die('배포 실패 (Cloudflare 로그인이 필요하면 npx wrangler login 후 다시 실행)');
console.log('\n✅ 완료! 게임 주소: https://thinkchip-arena.pages.dev  (처음엔 1~2분 뒤 열려요)');
console.log('   개인정보 처리방침: https://thinkchip-arena.pages.dev/privacy.html');
