# 더 지니어스들 (개발 가칭) — 모바일 두뇌게임 모음 v0.2

> 앱인토스 출시를 목표로 한 **플레이 가능한 웹 시제품**입니다. 방송 프로그램과 아무 관계가 없습니다. ‘더 지니어스들’이라는 이름은 상표/브랜드 혼동 위험이 있으므로 **정식 출시 이름으로 사용하기 전에 검토**해야 합니다.

## 지금 플레이 가능한 4개 게임

| 게임 | 규칙 | 혼자 | AI | 친구 |
|---|---|---|---|---|
| 뒤집어 3! | 숫자 3개로 연속/같은 수 조합, 숫자 뒤집기 | ✅ | ✅ 자동 플레이 AI 기록 | ✅ 동일 시드 기록 링크 |
| 블라인드 숫자전 | 1~9 숫자 카드를 한 번씩 사용해 AI와 큰 수 대결 | ✅ | ✅ AI 카드 대결 | ✅ 동일 시드 기록 링크 |
| 3장의 법칙 | 9장 중 속성이 전부 같거나 다른 카드 3장 찾기 | ✅ | ✅ AI 목표점수 경쟁 | ✅ 동일 시드 기록 링크 |
| 믿을까 배신할까 | 6회 협력/배신 게임, AI와 선택 비교 | ✅ | ✅ 규칙 기반 AI | ✅ 동일 시드 기록 링크 |

**친구 모드의 정확한 의미:** 실시간 1:1 턴제나 동기화된 친구방이 **아닙니다**. 보낸 사람이 게임을 끝낸 뒤 자신의 점수와 시드를 링크에 넣고, 친구가 같은 초기 조건으로 플레이하여 점수를 비교하는 **비동기 도전장 방식**입니다. 링크 내 점수는 변조할 수 있으므로 공식 리그/대결 보상에 그대로 사용하면 안 됩니다.

## 씽크칩 규칙 (시제품)

- 시작: 100칩.
- 혼자 연습 완료: +3칩 (동일 판 중복 지급 불가).
- 친구 도전 완료: +5칩 (승리 보상이 아니라 **참여 보상**입니다).
- AI 승리: 쉬움 +12 / 보통 +18 / 어려움 +25칩. 패배해도 최초 완료 시 +3칩.
- 게임 완료 보상: 1일 최대 총 100칩.
- 힌트: 1회 -30칩, **친구 기록 도전에서는 차단**.
- 보상형 광고: SDK 실제 `userEarnedReward` 이벤트를 받은 경우 +20칩, 하루 최대 5회.
- 체험 보너스: 시제품에만 존재하는 1회성 +50칩 버튼. 출시 전 반드시 제거.

모든 칩/기록은 브라우저 **localStorage에만 저장**됩니다. 다른 기기 동기화나 부정사용 방지는 되지 않습니다. 실제 앱인토스 서비스에서는 사용자 식별키 + 서버 검증 + 거래 원장을 사용해야 합니다.

## 가장 빠르게 시작하기 (Windows)

1. 압축을 `C:\Users\00000\Documents\GitHub\toss-arcade-duel`로 풉니다.
2. `PLAY_NOW.html`을 **더블클릭**합니다. Node.js나 추가 패키지 없이 플레이할 수 있습니다.
3. 개발할 때는 Node.js 20+ 설치 후 PowerShell에서 아래를 실행하세요.

```powershell
cd "C:\Users\00000\Documents\GitHub\toss-arcade-duel"
npm run dev
```

4. 브라우저에서 `http://localhost:5173`으로 접속합니다.
5. 게임 로직 테스트:

```powershell
npm test
```

6. `PLAY_NOW.html`을 소스에서 다시 만들고 싶으면:

```powershell
npm run pack:demo
```

**주의:** 로컬 주소(`localhost`)나 내 PC의 HTML 파일은 카카오톡으로 보내도 친구가 열 수 없습니다. 친구 초대는 실제 호스팅(공개 HTTPS) 또는 토스 앱 등록 후 동작합니다.

## 앱인토스용 작업 (추가 준비 필요)

이 프로젝트는 **앱인토스 업로드가 완료된 .ait 번들이 아닙니다.** 공식 SDK가 필요한 단계:

```powershell
npm install
npx ait init
npm run dev:ait
npm run build
```

- 앱인토스 콘솔에 게임 미니앱 등록 후 `apps-in-toss.config.ts`의 `appName`을 **콘솔과 일치**하도록 수정합니다.
- `src/toss.js`의 `TOSS_CONFIG.appName`과 `rewardedAdGroupId`를 실제 값으로 입력합니다.
- 토스 SDK 공유 API `Share.createLink` / `Share.sendMessage`가 호출될 수 있도록 준비했습니다.
- 광고 SDK `GoogleAdMob.loadAppsInTossAdMob` / `showAppsInTossAdMob` 이벤트 핸들러를 준비했으나, **실제 광고 그룹 ID가 없어서 광고 노출과 칩 지급은 비활성 상태**입니다.
- 모바일 샌드박스 실기기 테스트, 사용자 식별키, 서버 동기화, 광고 보상 검증, 심사 준비가 남아 있습니다.

현재 오프라인 환경이라 외부 npm 패키지를 설치하거나 실제 토스 SDK 번들을 생성해 검증하지 못했습니다. 개발 가이드: `docs/APP_IN_TOSS.md`, 백엔드 설계: `docs/BACKEND_DESIGN.md`.

## 폴더 구성

```text
index.html                    브라우저 개발용 시작 화면
PLAY_NOW.html                 설치 없이 실행하는 전체 게임 1파일
src/main.js                  게임 선택·대결·상점·기록 UI
src/styles.css               모바일 스타일
src/catalog.js               게임 목록
src/games/*.js               네 게임의 순수 규칙 엔진
src/wallet.js                씽크칩 정책과 로컬 지갑
src/toss.js                  토스 공유/광고 SDK 연동 지점
scripts/dev-server.mjs       의존성 없는 개발 서버
scripts/build-demo.mjs       오프라인 단일 HTML 생성
apps-in-toss.config.ts       앱인토스 구성 예시 (appName 수정 필수)
tests/*.test.js              규칙·UI 흐름 자동 테스트
legacy/flip-trio-original.html 이전 뒤집어 3! 시제품 보관
docs/*                       출시·백엔드 설계 문서
```

## 제작/검증

- `npm test`: 13개 자동 테스트 통과 (2026-11-06).
- 시각 검수: 자동 브라우저 정책 차단으로 스크린샷을 확보하지 못했습니다. 실제 Android/iOS/WebView UI 확인 필요.
- 외부 게임/방송의 로고, 그래픽, 음악, 영상, 명칭을 복사하지 않았습니다. 게임 명칭과 일부 일반적인 규칙의 법적 유사성 검토는 별도 필요합니다.
