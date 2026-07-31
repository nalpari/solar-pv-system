---
type: Configuration
title: Configuration
description: 환경변수는 공통/dev/prod 3파일로 분리되어 Jenkins credential 로 주입되며, NEXT_PUBLIC_* 만 빌드타임에 인라인된다.
resource: CLAUDE.md
tags: [configuration, env, secrets]
generated: { by: claude-code/opus-5, at: 2026-07-30T06:37:15Z }
status: stable
sources:
  - id: claude-md
    resource: CLAUDE.md
    title: Environment Variables 절
    last_modified: 2026-07-30
  - id: dockerfile
    resource: Dockerfile
    title: 빌드 ARG 선언
---

# 3파일 분리

| 파일 | 역할 | Jenkins credential |
|------|------|--------------------|
| `.env` | 공통 키 (dev/prod 동일) | `pv-common-env` (file) |
| `.env.dev` | dev 전용 오버라이드 | `pv-dev-env` (file) |
| `.env.prod` | prod 전용 오버라이드 | `pv-prod-env` (file) |

파이프라인이 `cat common + profile > .env` 로 병합한다 → **같은 키가 양쪽에 있으면 프로파일 파일이 이긴다**.
compose 는 `env_file: .env` 로 통째로 마운트한다.

**`.env.development` / `.env.production` 이라는 이름을 쓰지 않는 이유**: Next.js 가 `NODE_ENV` 를 보고 그 파일들을 자동 로드하는데,
이 프로젝트는 dev/prod 양쪽 다 `NODE_ENV=production` 으로 빌드한다. 이름이 겹치면 의미가 충돌한다.

# 빌드타임 vs 런타임

`NEXT_PUBLIC_*` 두 개만 빌드타임이다. 클라이언트 번들에 **문자열로 인라인**되므로 컨테이너 재시작으로는 바뀌지 않는다 — 이미지를 다시 빌드해야 한다.

| Variable | 파일 | 시점 | 용도 |
|----------|------|------|------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 공통 | 빌드 ARG | Maps JS / Places / Geometry / Geocoder |
| `NEXT_PUBLIC_AWS_S3_BASE_URL` | 공통 | 빌드 ARG | 업로드 이미지 공개 URL 조립 기준 |
| `OPENROUTER_API_KEY` | 공통 | 런타임 | [detect-roof](/interfaces/detect-roof.md) 추론 호출. 미설정 시 500 |
| `OPENROUTER_MODEL` | 공통 | 런타임 | 모델 슬러그(현행 `openai/gpt-5.6-sol`). 미설정 시 detect-roof 가 500. **기본값 없음**. 값이 `.env`(gitignore 대상)에만 있어 문서와 벌어지기 쉽다 — 바꾸면 이 표와 [ai-roof-detection](/modules/ai-roof-detection.md) 을 같이 고친다 |
| `GEMINI_API_KEY` · `GEMINI_MODEL` | 공통 | — | **미사용.** OpenRouter 전환 후 코드가 읽지 않는다. 안정화 관측 기간 롤백 대비로 잔존 |
| `REPLICATE_API_TOKEN` | 공통 | 런타임 | SAM 마스크. 미설정 시 조용히 건너뛴다(graceful degradation) |
| `AWS_REGION` / `AMPLIFY_BUCKET` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | 공통 | 런타임 | [image-upload](/interfaces/image-upload.md) |
| `QSP_API_HOST` | dev/prod | 런타임 | 모듈·축전지 마스터 |
| `MUSBI_API_HOST` | dev/prod | 런타임 | 발전 시뮬레이션 검증 |
| `MUSBI_CHECK_PATH` | dev/prod (선택) | 런타임 | 기본 `/qm/pwrgnSimulation/checkCalcResults` |
| `MUSBI_RESULT_PATH` | dev/prod (선택) | 런타임 | 기본 `/qm/pwrgnSimulation/calcResults` |
| `MUSBI_RESULT_HOST` | prod (선택) | 런타임 | 미설정 시 `MUSBI_API_HOST` 상속. 운영은 공식사이트로 분리 |
| `ENABLE_API_DOCS` | dev/prod | 런타임 | `"true"` 일 때만 `/api/openapi` · `/reference` 노출. dev=true / prod=false 권장 |
| `ALLOWED_ORIGIN` | dev/prod | 런타임 | **배포 필수.** 미설정 시 POST 가 전부 403 — [`security-perimeter.md`](security-perimeter.md) 참조 |

잔존 `GEMINI_*` 는 Jenkinsfile `Validate Environment` 의 검증 대상에서 빠졌다 — 검증하지 않는 여분 키는
파이프라인을 실패시키지 않으므로 남겨두는 비용이 0 이고, 롤백(git revert) 시 그대로 재사용된다.

# 새 키를 추가할 때

1. 공통 키면 `pv-common-env`, 환경별이면 `pv-dev-env` / `pv-prod-env` credential 파일에 추가.
2. `NEXT_PUBLIC_*` 이면 추가로 — `Dockerfile` 에 `ARG`/`ENV` 2줄, `docker-compose.yml` 각 서비스 `build.args` 에 1줄.
3. **무조건** Jenkinsfile `Validate Environment` 스테이지에 `: "${VAR:?...}"` 검증 라인 추가 (전수 검증 정책).

3번을 빠뜨리면 값이 없는 채로 배포가 성공하고, 런타임에 500 이나 403 으로 나타난다.
