# 앱인토스 출시 전 개발 체크리스트 (2026-11-06 기준)

공식 문서: https://developers-apps-in-toss.toss.im/

## 1. 현재 구현과 남은 개발

| 항목 | 시제품 | 정식 출시 |
|---|---|---|
| 게임 4종 및 규칙 기반 AI | 작동 | 밸런싱·실기기 검수 |
| 가입/로그인 화면 없는 플레이 | 작동 | 사용자 식별키 연동 |
| 친구 점수 도전 링크 | 쿼리스트링 기반 | 보안 링크 + 서버 대결방 |
| 씽크칩 지갑/힌트 | localStorage | 서버 지갑 원장 |
| 보상형 광고 | SDK 이벤트 연결 코드만 구현 | 콘솔 광고 그룹 ID·광고 로딩/검증 |
| 전체 순위 | 없음 | 게임센터 또는 서버 랭킹 |
| 배포용 앱인토스 번들 | 없음 | SDK 설치/브라우저/실기기 검증 |

## 2. SDK 설정

1. 앱인토스 파트너 콘솔에 **게임** 유형 미니앱을 등록합니다.
2. `npm install @apps-in-toss/web-framework`, `npx ait init` 실행.
3. `apps-in-toss.config.ts`의 `appName`을 콘솔에 등록된 정확한 값으로 교체합니다.
4. `src/toss.js`의 `TOSS_CONFIG.appName`과 `rewardedAdGroupId`를 실제 값으로 교체합니다.
5. `npm run dev:ait`, `npm run build` 및 샌드박스/토스앱 실기기 테스트를 합니다.
6. `src/toss.js`의 `GoogleAdMob` SDK 노출 경로/함수 지원 여부를 실제 설치 버전에서 확인합니다. 패키지 설치를 수행할 수 없어 자동 빌드 검증을 하지 못했습니다.

웹뷰 가이드: https://developers-apps-in-toss.toss.im/ai-vibe-coding/tutorials/webview
SDK 공유 링크: https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/share/share.createlink
보상형 광고 로딩: https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/ads/googleadmob.loadappsintossadmob
보상형 광고 표시: https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/ads/googleadmob.showappsintossadmob

## 3. 보상형 광고 안전 원칙

- 사용자가 **자발적으로** 광고 보기 버튼을 탭합니다.
- 사전에 로드한 광고를 표시합니다. 광고 클릭/노출/닫힘 이벤트는 보상 조건이 아닙니다.
- `userEarnedReward` 이벤트만 지급 트리거로 취급합니다.
- 앱은 동일 광고 보상의 중복 지급과 일일 횟수 제한을 적용해야 합니다.
- **현재는 클라이언트 로컬스토리지에 기록**하므로 변조될 수 있습니다. 프로덕션에서는 서버에 지급 요청을 검증한 뒤 원장에 원자적으로 반영합니다. 제공되는 서버 측 광고 검증 메커니즘이 있다면 사용하고, 없다면 적절한 사기 방지 정책을 추가합니다.
- 광고가 준비되지 않았거나 사용자가 중도 종료하면 보상을 지급하지 않습니다.
- 출시 시 시제품의 `체험 보너스 +50칩` 버튼을 제거합니다.

## 4. 로그인 없이 데이터 저장

공식 게임 미니앱은 사용자 식별키를 사용할 수 있습니다(별도 로그인 화면 불필요). 단, 사용자의 식별키 문자열을 서버에 단순히 전달하는 것만으로 인증이 된다고 가정하지 마세요. 서버 발급 인증/검증 방식과 요청 보호를 별도 구현해야 합니다.

사용자 식별키 안내: https://developers-apps-in-toss.toss.im/guide/authentication/anon-key

## 5. 친구 대결의 두 단계

**이번 시제품:** 링크에 `{ game, seed, target, from }`을 포함하여 같은 조건의 점수 도전 가능. 제출된 점수는 자동 통합하지 않습니다.

**출시용 목표:** 서버가 발급한 무작위 `challengeId`만 링크에 담고, 상대는 서버에서 시드·공식 점수를 조회. 제출자는 전체 선택 이벤트를 서버에 보내고, 서버가 규칙 엔진으로 점수를 재계산. 동일 판 중복 보상 금지. `README.md` 및 `BACKEND_DESIGN.md` 참고.

## 6. 검수 주의사항

- 인앱 광고를 예상치 못한 순간에 강제로 노출하지 말 것
- 음악을 넣을 경우 On/Off·백그라운드 상태 처리
- Safe Area, 뒤로가기, 닫기 버튼, 작은 모바일 화면 확인
- 게임 미니앱 사용자 식별키 및 기록 유지
- SDK 호출 폭주 방지, HTTPS/WSS, 외부 웹뷰/리디렉션 정책 준수
- 개인정보와 거래 데이터 암호화
- 출시 전 이름 **'더 지니어스들'** 이 방송 《더 지니어스》와 혼동될 수 있는지, 상표와 콘텐츠 권리 모두 확인
- 씽크칩은 현금 환전/유저 베팅에 사용하지 않는 비현금성 포인트로 제한

게임 체크리스트: https://developers-apps-in-toss.toss.im/checklist/app-game
