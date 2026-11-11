# 출시용 서버 아키텍처 초안 — 씽크칩/친구 대결

> 이 문서에 적힌 API는 아직 서버에 구현된 것이 아닙니다. 1차 시제품은 로그인 없이 브라우저에서만 동작합니다.

## 목적

- 계정을 만드는 화면 없이 토스 앱의 미니앱 사용자 식별키를 사용해 게임 기록·칩 잔액을 유지
- 친구끼리 링크로 같은 게임방에 접속하여 점수 검증 및 순위 공유
- 보상형 광고 시청에 따른 씽크칩 중복 지급을 방지하고 힌트 구매를 안전하게 처리

## 권장 저장 모델

```text
users(
  id PK, toss_user_key UNIQUE, nickname, created_at
)
challenge(
  id PK, game_code, rules_version, seed, creator_id, creator_score,
  created_at, expires_at, visibility
)
challenge_run(
  id PK, challenge_id FK, user_id FK, score, event_log_json,
  replay_digest, created_at, UNIQUE(challenge_id, user_id, replay_digest)
)
wallet(
  user_id PK, balance, updated_at
)
chip_ledger(
  id PK, user_id FK, reason, delta, idempotency_key UNIQUE, created_at
)
ad_reward(
  id PK, user_id FK, ad_event_id UNIQUE, ad_group_id, verified_at
)
```

## 제안 API

```text
GET  /v1/me                   유저 닉네임·칩 잔액·최고 점수
POST /v1/challenges           시드/게임/규칙 버전 고정·무작위 방 ID 발급
GET  /v1/challenges/{id}      친구방의 시드, 기록, 종료 시각 조회
POST /v1/challenges/{id}/runs 행동 이벤트 전송·서버 점수 재계산
POST /v1/hints/purchase       한 번만 -30칩 차감 (트랜잭션)
POST /v1/ad-rewards/claim     검증된 광고 이벤트 중복 차단 후 +20칩
GET  /v1/leaderboard         승인된 점수만 순위 반영
```

## 서버 검증 방식

1. 앱은 난수 시드로 플레이하고 모든 선택 이벤트를 로컬에 순서대로 기록합니다.
2. 완료 시 `game`, `rules_version`, `seed`, `moves`를 전송합니다.
3. 서버는 해당 규칙 버전의 순수 엔진을 같은 시드로 재실행해 점수를 계산합니다.
4. 서버 점수만 공식 친구 승패·랭킹에 반영합니다. 클라이언트에서 보낸 `score`를 신뢰하지 않습니다.
5. 씽크칩 지급/차감은 서버 DB 트랜잭션 + unique idempotency 키로 처리합니다.
6. 신분 연계에는 공식 토스 사용자 식별키의 **인증 가능한 흐름**을 사용하고, 전달된 사용자 식별자만으로 권한을 부여하지 않습니다.
7. 광고 이벤트는 SDK 콜백만으로 원천적 부정 사용을 막을 수 없습니다. 실제 사용할 수 있는 서버 검증·중복 방지 수단을 확인해 지급 엔드포인트를 보강합니다.

## 공정성

- 친구 기록 대결에서는 힌트 구매/광고를 통한 추가 기회 금지
- AI 승리 보상은 난이도별 지급 한도와 중복 클리어 방지 적용
- 친구 대결에서 실시간 협력/배신 또는 동시 카드 제출을 지원하려면 `wss://` 서버/상대 턴 처리·타임아웃·이탈 처리 추가
- 비현금성 칩은 출금·환전·베팅을 지원하지 않음
