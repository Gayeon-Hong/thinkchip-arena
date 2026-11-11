# 앱인토스 출시 가이드 (게임)

## 한 번에 빌드
`02_build_ait_windows.cmd` 더블클릭 → 콘솔 appName·보상형 광고 그룹 ID 입력 → 설치·테스트·빌드 → `.ait` 생성.
콘솔 > 앱 출시 > 버전 등록하기 에 `.ait` 업로드 → 샌드박스/QR 테스트 → 검토 요청.

## 이번 출시 준비에서 바뀐 것
- 빠져 있던 `src/icons.js`, `app.config.js` 복구 (소스만으로는 화면이 안 뜨던 문제)
- 게임 내비게이션 바(`webViewProps.type = 'game'`) + Safe Area 적용, 헤더가 토스 ⋯/X 버튼과 겹치지 않게 조정
- 보상형 광고: 통합 인앱 광고 API(`loadFullScreenAd`/`showFullScreenAd`), 미리 로드 → 시청 → 다시 로드
  - `userEarnedReward` 이벤트일 때만 +20칩, 하루 5회. 개발 중에는 공식 테스트 ID(`ait-ad-test-rewarded-id`) 사용
- 사용자 식별키(`User.getAnonymousKey`)로 토스 계정별 기록 저장 (기존 기기 기록은 첫 실행 때 이어받음)
- 안드로이드 뒤로가기: 앱 안에서 이전 화면, 홈에서는 "게임을 종료할까요?" 확인 후 종료
- 시제품 문구, "체험 보너스 +50칩" 제거 / 작은 버튼 크기 보정

## 출시 전 꼭 확인
- **앱 이름**: 씽크칩 아레나 (appName `thinkchip-arena`). 출시 전 키프리스(kipris.or.kr)에서 상표 검색 권장
- 실제 광고 그룹 ID로 빌드했는지 (테스트 ID로 출시하면 수익 0)
- QR로 실기기에서: 광고 끝까지 보기 → +20칩, 중간에 닫기 → 지급 안 됨, 광고 후 화면 복귀
- 친구 도전 링크가 토스에서 열리는지 (`intoss://앱이름?game=...`)
