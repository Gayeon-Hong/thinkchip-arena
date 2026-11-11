// One-click release build for Apps in Toss: asks for console values once, then install -> test -> build .ait
import {readFileSync, writeFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = join(ROOT, '.env'), CFG = join(ROOT, 'apps-in-toss.config.ts');
const run = (cmd) => spawnSync(cmd, {shell: true, cwd: ROOT, stdio: 'inherit'}).status === 0;
const die = (m) => { console.error('\n[실패] ' + m); process.exit(1); };
const parse = (t) => Object.fromEntries(t.split(/\r?\n/).map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));

const env = existsSync(ENV) ? parse(readFileSync(ENV, 'utf8')) : {};
const rl = createInterface({input: process.stdin, output: process.stdout});
console.log('\n==== [1/4] 앱인토스 콘솔 정보 ====');
while (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(env.VITE_TOSS_APP_NAME || '')) {
  env.VITE_TOSS_APP_NAME = (await rl.question('콘솔에 등록한 영문 appName (예: brain-arena): ')).trim();
}
// 광고 ID 는 'ait.' 로 시작해요. 앱 이름 같은 엉뚱한 값이 들어가 있으면 다시 물어봐요.
if (env.VITE_REWARDED_AD_GROUP_ID && !/^ait[.-]/.test(env.VITE_REWARDED_AD_GROUP_ID)) { console.log(`⚠ 저장된 광고 ID(${env.VITE_REWARDED_AD_GROUP_ID})가 광고 그룹 ID 형식이 아니에요. 다시 입력해 주세요.`); env.VITE_REWARDED_AD_GROUP_ID = ''; }
if (env.VITE_REWARDED_AD_GROUP_ID === undefined || env.VITE_REWARDED_AD_GROUP_ID === '') {
  console.log('보상형 광고 그룹 ID: 콘솔 > 인앱 광고 에서 "보상형" 광고 그룹을 만들면 나와요. (없으면 Enter → 광고 없이 빌드)');
  env.VITE_REWARDED_AD_GROUP_ID = (await rl.question('보상형 광고 그룹 ID: ')).trim();
}
if (/^ait-ad-test/.test(env.VITE_REWARDED_AD_GROUP_ID)) {
  const ok = (await rl.question('⚠ 테스트 광고 ID예요. 출시 빌드에 쓰면 수익이 나지 않아요. 계속할까요? (y/N): ')).trim().toLowerCase();
  if (ok !== 'y') die('실제 광고 그룹 ID로 다시 실행해 주세요.');
}
rl.close();
writeFileSync(ENV, `VITE_TOSS_APP_NAME=${env.VITE_TOSS_APP_NAME}\nVITE_REWARDED_AD_GROUP_ID=${env.VITE_REWARDED_AD_GROUP_ID}\n`);
const cfg = readFileSync(CFG, 'utf8').replace(/appName:\s*'[^']*'/, `appName: '${env.VITE_TOSS_APP_NAME}'`);
writeFileSync(CFG, cfg);
console.log(`appName=${env.VITE_TOSS_APP_NAME}, 광고=${env.VITE_REWARDED_AD_GROUP_ID || '없음'}`);

console.log('\n==== [2/4] 패키지 설치 ====');
if (!existsSync(join(ROOT, 'node_modules', '@apps-in-toss'))) { if (!run('npm install')) die('npm install 실패'); } else console.log('이미 설치됨');
console.log('\n==== [3/4] 게임 로직 테스트 ====');
if (!run('npm test')) die('테스트 실패');
console.log('\n==== [4/4] .ait 빌드 ====');
if (!run('npm run build')) die('빌드 실패. 위 오류를 복사해 주세요.');
const aits = readdirSync(ROOT).filter(f => f.endsWith('.ait')).map(f => join(ROOT, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
console.log('\n✅ 완료! 콘솔 > 앱 출시 > 버전 등록하기 에 올릴 파일:\n  ' + (aits[0] || '(프로젝트 폴더에서 .ait 파일을 찾아 주세요)'));
