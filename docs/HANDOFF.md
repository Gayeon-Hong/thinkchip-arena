# 씽크칩 아레나 (ThinkChip Arena) — 프로젝트 인수인계 문서

> 다른 AI/개발자가 이어서 작업할 수 있도록 정리한 문서입니다. 마지막 갱신: 2026-11-12

## 1. 한 줄 요약

친구들과 3D 라운지에 모여 **채팅하고, 캐릭터·내 방을 꾸미고, 두뇌·심리전 미니게임을 함께 하는** 모바일 웹게임.
게임 재화는 **씽크칩(⬡)** 하나. 게임·출석·광고로 모으거나(무료 칩) 결제로 충전한다(유료 칩).

- 저장소: `github.com/Gayeon-Hong/thinkchip-arena` (브랜치 `main`)
- 웹(= MS Store 앱이 불러오는 주소): `https://thinkchip-arena.pages.dev`
- 실시간·계정 서버: `https://thinkchip-live.000000000078.workers.dev` (Cloudflare Workers + Durable Objects), 웹소켓 `/live/<방코드>`
- 정책 페이지: `/privacy.html`, `/refund.html` (원본은 `public/`)

## 2. 배포 대상

| 플랫폼 | 형태 | 업데이트 | 결제 |
|---|---|---|---|
| 웹 | Cloudflare Pages | `main` 푸시 → GitHub Actions `deploy-web.yml` 자동 배포 | 없음 (웹에선 칩 판매 안 함) |
| Microsoft Store | 웹을 감싼 PWA 앱 (앱 ID 9NCHPTNWQNW7) | 웹 배포 = 자동 반영 | MS Store 추가 기능 (Digital Goods API) |
| 앱인토스 (토스 미니앱) | `.ait` 번들 | `02_build_ait_windows.cmd` → 콘솔 업로드 → 검토 | 앱인토스 인앱결제 (IAP SDK) |

- 실시간 서버: `live-server/**` 가 바뀐 푸시 → `deploy-live.yml` 이 `wrangler deploy` + 시크릿(KAKAO_REST_KEY, KAKAO_CLIENT_SECRET) 등록.
- GitHub Secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, KAKAO_REST_KEY, KAKAO_CLIENT_SECRET.
- 토스 빌드는 `vite.config.js` 플러그인이 `dist/lounge/config.js` 끝에 `window.THINKCHIP_CONFIG.TOSS = true;` 를 붙인다 → 라운지가 토스 모드(로그인 UI 없음, 칩 선물 숨김)로 동작.

### 결제 상품 (app.config.js `chipPacks`)
| sku (MS·서버) | 토스 상품 ID | 지급 | 가격 |
|---|---|---|---|
| chips_300 | ait.0000098395.082c18cf.2be99887a0.4467161148 | 300칩 | MS 1,200원 / 토스 1,199원 |
| chips_1000 | ait.0000098395.8b7347b8.b664cd8029.4467283967 | 1,100칩 | 3,300원 |
| chips_3000 | ait.0000098395.34707b2f.0a2e449a2b.4467393007 | 3,500칩 | 9,900원 |
| vip_30 | ait.0000098395.4d757553.5327de2082.4468048393 | 500칩 + VIP 30일 | MS 4,900원 / 토스 4,906원 |

토스 판매가는 공급가 10원 단위 + VAT 라서 1,200·4,900 을 정확히 못 맞춘다. 서버 지급표는 `live-server/src/index.js` 의 `CHIP_PACKS`, `VIP_PACKS`.

## 3. 폴더 구조

```
src/                  메인 앱(게임 아레나) — vite 로 번들
  main.js             화면(home, intro, live, wallet, aiturn …), 게임 진행, 실시간 대전 UI, 원카드
  wallet.js           로그인 전 로컬 지갑 (free/paid)
  toss.js             토스 SDK / MS 결제 / 광고 / 공유 / chipsForSku
  catalog.js          게임 목록, 파티 게임
  games/*.js          미니게임 엔진 (+ xxxBotRun: AI 플레이 재생용), bluff.js(AI 블러핑)
public/account.js     로그인·서버 지갑 클라이언트 (window.ThinkChipAccount) — 메인 앱과 라운지가 공유
public/lounge/        3D 라운지 원본 (three.js, 번들 없음)
  lounge.js           라운지 전체 (씬, 이동, 채팅, 꾸미기, 친구, VIP, 슈퍼챗, 가구, 구매/취소 …)
  avatar.js           아바타 생성·애니메이션 (남/여 체형, 옷장 WARDROBE, 앉기/눕기/무릎꿇기)
  config.js           자동 생성 — 직접 수정 금지
lounge/, index.html, PLAY_NOW.html, privacy.html, refund.html, account.js
                      build-demo 가 만드는 루트 미러. 원본은 public/ · src/
live-server/src/index.js  Room DO(방·파티·턴제·원카드·채팅·슈퍼챗) + User DO(계정·지갑·친구·선물·VIP·뱃지)
scripts/build-demo.mjs   루트 미러/PLAY_NOW 생성 (src 파일을 이어 붙임 → 최상위 이름 중복 금지, 새 src 파일은 순서 목록에 추가)
tests/                node --test (npm test)
store-assets/iap/     인앱 상품 이미지 (1024px)
```

**작업 규칙:** 수정 후 `node scripts/build-demo.mjs` → `npm test` (PLAY_NOW 최신 여부도 검사) → 루트 미러까지 같이 커밋.

## 4. 기능 요약

### 계정·지갑 (서버)
- 웹·MS: 카카오 로그인(`/auth/kakao/start` → 콜백이 `#session=` 으로 돌려줌). 토스: `/auth/toss` 자동(로그인 UI 없음). 로그인 전엔 둘러보기만.
- 계정 pid = HMAC(secret, 'pid:'+acct) 24자. 세션 토큰 = base64url({a,p,e}) + HMAC.
- `/api/user` op: hello, earn(하루 200, 판당 150), ad(보상형 광고 시청 보상), attend(+30, 출석 횟수 기록), spend(what 기록→10분 취소), refund, purchase(아래 '결제 검증'), import, save, request/accept/decline/remove(친구), gift(유료 칩만), giftItem(번 칩 OK), invite, seen, vip, vipEnter, superchat, skin, deleteAccount.
- 첫 로그인 +300칩. ADMIN_PIDS(wrangler.toml)는 옷·가구 전부 보유.
- **구매 취소:** 구매 기록(u.buys)을 남기고 10분(REFUND_MS) 안에만 refund. 슈퍼챗·선물은 취소 불가. 모든 구매는 클라이언트 확인 창(confirmBuy).
- **계정 삭제:** 친구 관계 해제 후 데이터 초기화. 재가입 보상 악용 방지용으로 식별값·삭제일·결제 주문번호만 남김.

### 결제 검증 (서버 `purchase` op)
- 클라이언트는 결제 완료 후 `{sku, orderId, store}` 를 기기 큐(`thinkchip:purchaseq`)에 넣고 서버에 올린다. 실패·대기면 큐에 남아 다음에 재시도.
- **토스**(u.platform==='toss' 또는 store==='toss'): `env.TOSS_MTLS.fetch(POST https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/order/get-order-status, {orderId})`. PURCHASED/PAYMENT_COMPLETED + sku 일치일 때만 지급, ORDER_IN_PROGRESS/ERROR 는 503 'pending'(재시도), FAILED/REFUNDED/NOT_FOUND/MINIAPP_MISMATCH 는 'bad'. 토스 sku → 서버 sku 표는 `TOSS_SKUS`.
- mTLS 인증서: wrangler.toml `[[mtls_certificates]] binding="TOSS_MTLS" certificate_id="485e0541-1f6c-49cf-8f2f-7fe487315290"`. **2027-12-07 만료** → 콘솔(개발 > mTLS 인증서)에서 재발급 → `toss-mtls/` 폴더에 crt·key → `05_toss_mtls_upload_windows.cmd` → 새 ID 로 교체. 개인 키는 커밋 금지(.gitignore 처리됨).
- **MS**: PWA(Digital Goods API)는 서버 검증 공식 경로가 없어서, 확인 안 된 지급을 계정당 24시간 5건으로 제한(초과분은 429 'pending' → 다음 날 지급).
- 공통: 주문번호는 `__orders__` User DO 의 `claimOrder` 로 전체 계정에서 한 번만 지급.

### 광고
- 토스 보상형 광고(통합 인앱 광고 loadFullScreenAd → showFullScreenAd), `src/toss.js`. 광고 그룹 "씽크칩 보상형" `ait.v2.live.110bd1db3cac4da0` (app.config.js `rewardedAdGroupId`, 개발 빌드는 테스트 ID). 보상은 서버 `ad` op 가 지급(하루 한도).
- 웹·MS 에는 광고 없음.

### 라운지
- 공개 라운지(LNG1~9, 꽉 차면 다음 방), 친구 라운지(코드), **내 방**(코드 = 'H'+pid 앞 5자), **VIP 라운지**(VIP1: 워커가 세션·입장권·뱃지 확인).
- 상단 [라운지|내 방] 전환, 왼쪽 벽의 문으로도 이동. 내 방: 벽지·바닥·러그, 가구 자유 배치(45° 단위 회전), 가구 사용(앉기·눕기·피아노 소리·TV/조명 켜기 등, 자세는 다른 사람에게도 보임), 드레스룸, 뱃지 진열장, 비서.
- 접속자·친구 패널(상단 "N명" 버튼): 같은 방 사람, 친구 온라인/오프라인·위치, 초대(오프라인이면 다음 접속 때 알림), 따라가기/놀러가기.
- 리액션(하트·우우·장미=무릎 꿇기), 친구 맺기 손인사, 전광판 슈퍼챗(50/200칩), 한정판 비서 스킨(사주면 답례 선물), 욕설 필터(슈퍼챗 차단, 채팅 ♡ 마스킹).
- 뱃지 11종 (서버 계산): 승리 1/10/50/100, 우승 1/3, MVP, 친구 5명, 출석 7회, VIP 회원, 비서 단골. 50승·우승·MVP 는 VIP 무료 입장.

### 게임
- 혼자 / AI 대결(AI 플레이를 화면으로 재생) / 실시간(턴제 관전 중계 또는 동시) / 파티(빈자리 AI 1~3명). 시간 제한·턴 넘기기. 원카드 실시간.
- 승패로 칩이 오가지 않는다(사행성 방지). 1승은 사람 2명 이상 판의 단독 1등만 인정.

## 5. 현재 상태 (2026-11-12)

- MS: 칩 상품 3개 판매 중, 세금·지급 Complete. vip_30(Store ID 9PP9CVHTZW2N, 4,900원) 심사 중 → 통과 시 자동 공개.
- 토스: 인앱 상품 4개 등록·노출 ON. 버전 20261112-7 검토 중(이 빌드엔 광고 그룹 ID 없음). 광고가 들어간 새 AIT 빌드를 올려야 함 → 통과 후 **출시하기**.
- 결제 검증(토스 mTLS) · MS 제한 · 광고 그룹 ID 모두 main 에 반영, 서버 배포 완료.
- 사업·할 일 메모(사용자용 문서): https://claude.ai/artifact/VMD58T32vjQNGkRVdUrVvY

## 6. 남은 일 / 알려진 한계

- 광고 들어간 AIT 재빌드·업로드 → 출시 → 첫 실결제 지급 확인.
- MS 결제는 서버 검증 없음(하루 5건 제한으로 완화). 네이티브 앱으로 바꾸면 Collections API(Entra ID) 검증 가능.
- 토스 로그인이 실패해 기기 계정으로 들어간 경우, 옛 빌드(20261112-7)는 store 값을 안 보내 검증을 건너뜀 → 새 빌드부터 해결.
- 슈퍼챗·채팅 욕설 필터는 단어 목록 방식(오탐 가능: "새끼 고양이").
- 앉기 자세는 몸을 낮추는 방식(다리 관절 없음). TV·조명 켜기는 내 화면에만 적용.
- 뱃지 기록은 2026-11-12 부터 쌓임. Room 의 pid 는 클라이언트가 보내는 값이라 승리 기록 자체는 완전 신뢰는 아님.
- 웹에서는 칩을 팔지 않음(필요하면 토스페이먼츠 연동). 웹·MS 광고(애드센스)는 보류.
- 광고 수익 정산: 매달 초 정산 메일 → 팝빌 세금계산서 승인(사업자 인증서 필요).

## 7. 테스트 방법

- `npm test` (node --test, 51개).
- 로컬 실시간 서버: `cd live-server && npx wrangler dev --port 8799 --var DEV_LOGIN:1` → `/auth/dev?name=X` 로 테스트 토큰.
- 로컬 웹: `PORT=5180 node scripts/dev-server.mjs` → `/lounge/index.html`. 라운지는 `window.__lounge` 에 테스트용 함수(openZone, goZone, players, screenOf, furniture …)가 있다.
