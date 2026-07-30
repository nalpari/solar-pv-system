---
type: Deployment
title: Deployment
description: Docker 멀티스테이지 standalone 이미지를 Jenkins 파이프라인이 dev/prod 프로파일로 배포한다.
resource: Jenkinsfile
tags: [deployment, docker, jenkins, ci]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
verified: { by: claude-code/opus-5, at: 2026-07-27T05:09:59Z }
status: stable
sources:
  - id: dockerfile
    resource: Dockerfile
    title: 멀티스테이지 빌드 정의
    last_modified: 2026-06-24
  - id: compose
    resource: docker-compose.yml
    title: dev/prod 서비스 정의
    last_modified: 2026-06-24
  - id: jenkinsfile
    resource: Jenkinsfile
    title: 배포 파이프라인
    last_modified: 2026-06-24
---

# 이미지

`Dockerfile` 은 4스테이지다 — `base`(node:20-alpine + pnpm 10) → `deps` → `builder` → `runner`.

- **검증이 빌드 안에 있다.** `builder` 스테이지가 `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` 를 차례로 실행한다.
  Jenkins 에이전트에 Node 를 깔지 않기 위한 선택이다 — 린트/타입 실패는 이미지 빌드 실패로 나타난다.
- `runner` 는 `.next/standalone` 만 복사하고 `node server.js` 로 뜬다. 비루트 사용자 `nextjs`(uid 1001).
- `ENV HOSTNAME="0.0.0.0"`, `PORT=3000` — 이 바인드 주소가
  [`security-perimeter.md`](security-perimeter.md) 의 `ALLOWED_ORIGIN` 필수 조건을 만든다.

# 프로파일과 포트

| 서비스 | 프로파일 | 호스트 포트 | 비고 |
|--------|----------|-------------|------|
| `app-dev` | `dev` | 4010 | 단일 인스턴스 |
| `app-prod-4000` | `prod` | 4000 | 이미지를 빌드하는 쪽 |
| `app-prod-4001` | (프로파일 지정 없음) | 4001 | `app-prod-4000` 이미지를 재사용, `depends_on` |

⚠️ `app-prod-4001` 에는 `profiles:` 키가 없다. compose 에서 프로파일 없는 서비스는 **항상 대상에 포함**되므로
`--profile dev` 로 dev 를 띄울 때도 이 서비스가 딸려올 수 있다. Jenkinsfile 이 서비스명을 명시적으로 나열해
(`up -d --wait app-dev`) 이를 회피하고 있다 — 즉 안전성이 compose 파일이 아니라 파이프라인 호출부에 걸려 있다.

# 배포 게이트

Jenkins 에이전트가 DooD(Docker-outside-of-Docker) 컨테이너라 **호스트 publish 포트에 닿지 못한다**.
그래서 헬스체크를 컨테이너 내부에서 수행한다(`x-app-healthcheck`, busybox `wget` 으로 `127.0.0.1:3000`),
파이프라인은 `docker compose ... up -d --wait` 로 healthy 상태를 게이트한다.
외부에서 `curl localhost:4000` 하는 방식으로 바꾸면 Jenkins 에서 반드시 실패한다.

# 파이프라인 단계

1. **Checkout**
2. **Load Env Credential** — `pv-common-env` + (`pv-dev-env` | `pv-prod-env`) 를 `cat` 으로 합쳐 `.env` 생성.
   같은 키가 양쪽에 있으면 프로파일 파일이 이긴다. [`configuration.md`](configuration.md) 참조.
3. **Validate Environment** — 모든 키를 `: "${VAR:?...}"` 로 전수 검증. 새 환경변수를 추가하면 **여기에도 줄을 추가**해야 한다.
4. **Verify** — 두 가지를 한다.
   - `bash docs/okf/check.sh` — OKF 번들 신선도. **비차단**(`|| true`)이며 문서 문제로 배포를 막지 않는다.
     긴 빌드 로그에 묻히지 않도록 먼저 실행한다. `pnpm` 이 아니라 `bash` 로 직접 부르는 이유는
     **에이전트에 Node 가 없기 때문**이다 — `check.sh` 는 bash + git 만 쓴다. bash 가 없으면 건너뛴다.
   - `docker build --target builder` — lint·tsc·build 를 컨테이너 안에서 수행한다.
     레이어는 Deploy 의 `compose build` 와 캐시를 공유하고, 검증용 태그는 즉시 `rmi` 한다.
5. **Deploy** — `IMAGE_TAG=${BUILD_NUMBER}` 로 빌드 → `:{profile}-latest` 태그 부여 → 구버전 이미지 정리 → `up -d --wait`

# 로컬

```bash
docker compose --profile dev up --build      # 포그라운드
docker compose --profile dev up --build -d   # 백그라운드
docker compose down
```
