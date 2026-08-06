# CI/CD 파이프라인

> 대상 커밋: `761cc1f` (2026-07-27) + 2026-07-30 OpenRouter 전환 반영 · 근거 파일: `Jenkinsfile`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`
> 도메인 개념의 진실의 원천은 [`docs/okf/system/deployment.md`](okf/system/deployment.md) · [`docs/okf/system/configuration.md`](okf/system/configuration.md) 이다.
> 본 문서는 그 두 개념을 파이프라인 운영자 관점에서 한 곳에 펼쳐 놓은 것이다.

## 1. 한눈에

| 항목 | 내용 |
|------|------|
| CI 엔진 | **Jenkins Declarative Pipeline** (`Jenkinsfile`, 루트) |
| GitHub Actions | **없음** — `.github/` 디렉터리 자체가 없다 |
| 트리거 | `triggers { }` 블록 없음 → **수동 실행(파라미터 빌드) 전용**. 푸시 훅으로 자동 배포되지 않는다 |
| 파라미터 | `PROFILE` = `dev` \| `prod` (choice, 기본값 `dev`) |
| 동시 실행 | `disableConcurrentBuilds()` — 같은 잡의 병렬 실행 금지 |
| 빌드 산출물 | Docker 이미지 `solar-pv-system:{profile}-{BUILD_NUMBER}` |
| 배포 방식 | 같은 Docker 호스트에서 `docker compose up -d --wait` (blue/green 없음, 순단 있음) |
| 아티팩트 저장소 | **없음** — 레지스트리에 push 하지 않고 로컬 데몬 이미지로만 존재 |

`PROFILE` 하나가 브랜치·credential·서비스·포트를 전부 결정한다.

| PROFILE | 브랜치 | env credential | compose 프로파일 | 서비스 | 호스트 포트 |
|---------|--------|----------------|------------------|--------|-------------|
| `dev` | `dev` | `pv-common-env` + `pv-dev-env` | `dev` | `app-dev` | 4010 |
| `prod` | `main` | `pv-common-env` + `pv-prod-env` | `prod` | `app-prod-4000`, `app-prod-4001` | 4000, 4001 |

## 2. 전체 흐름

```
 [사용자] "Build with Parameters" → PROFILE 선택
     │
     ▼
 ┌─ Checkout ────────────────────────────────────────────────┐
 │ skipDefaultCheckout(true) → GitSCM 으로 명시 체크아웃      │
 │ prod → */main   dev → */dev                                │
 └────────────────────────────────────────────────────────────┘
     ▼
 ┌─ Load Env Credential ─────────────────────────────────────┐
 │ withCredentials(file)                                      │
 │   cat pv-common-env  >  .env                               │
 │   cat pv-{profile}-env >> .env      ← 같은 키는 이쪽이 승  │
 │   chmod 600 .env                                           │
 └────────────────────────────────────────────────────────────┘
     ▼
 ┌─ Validate Environment ────────────────────────────────────┐
 │ . ./.env 후 12개 키를 : "${VAR:?msg}" 로 전수 검증         │
 │ docker compose version                                     │
 │ → 하나라도 비면 여기서 즉시 실패 (배포 전 차단)            │
 └────────────────────────────────────────────────────────────┘
     ▼
 ┌─ Verify ──────────────────────────────────────────────────┐
 │ ① bash docs/okf/check.sh          ← 비차단(경고만)         │
 │ ② docker build --target builder   ← lint+tsc+build 수행    │
 │    성공 시 verify 태그 즉시 rmi (레이어 캐시는 남음)       │
 └────────────────────────────────────────────────────────────┘
     ▼
 ┌─ Deploy ──────────────────────────────────────────────────┐
 │ IMAGE_TAG=${BUILD_NUMBER}                                  │
 │ compose build → retag :{profile}-latest                    │
 │ compose up -d --wait  ← healthcheck healthy 까지 블로킹    │
 │ prune_old_images (최근 2개 빌드만 보존)                    │
 └────────────────────────────────────────────────────────────┘
     ▼
 ┌─ post { always } ─────────────────────────────────────────┐
 │ docker compose ps (dev+prod 전체) · rm -f .env             │
 └────────────────────────────────────────────────────────────┘
```

## 3. 스테이지별 상세

### 3.1 Checkout

`options { skipDefaultCheckout(true) }` 로 Jenkins 기본 체크아웃을 끄고, 스테이지 안에서 `GitSCM` 을 직접 호출한다.
`userRemoteConfigs` / `extensions` 는 잡에 설정된 `scm` 객체에서 그대로 재사용하고 **브랜치만 파라미터로 바꾼다**.

```groovy
def targetBranch = params.PROFILE == 'prod' ? 'main' : 'dev'
```

→ 잡 설정에서 어떤 브랜치를 걸어놨든, 실제 빌드 대상은 `PROFILE` 이 정한다.

### 3.2 Load Env Credential

Jenkins **Secret file** credential 3종을 `cat` 으로 이어붙여 워크스페이스에 `.env` 를 만든다.

| credential ID | 역할 |
|---------------|------|
| `pv-common-env` | dev/prod 공통 키 (Maps, OpenRouter, AWS S3) |
| `pv-dev-env` | dev 전용 (QSP/MUSBI 호스트, 문서 노출 플래그, Origin 허용목록) |
| `pv-prod-env` | prod 전용 |

```sh
cat "$ENV_COMMON" > .env
printf '\n' >> .env      # 공통 파일 끝에 개행이 없어도 첫 프로파일 키가 붙지 않도록
cat "$ENV_PROFILE" >> .env
chmod 600 .env
```

**병합 순서 = 우선순위.** 뒤에 오는 프로파일 파일이 같은 키를 다시 정의하면 `set -a; . ./.env` 시 **나중 값이 이긴다**.

### 3.3 Validate Environment

`.env` 를 소싱한 뒤 필수 키를 `: "${VAR:?메시지}"` 로 전수 검증한다. 검증 대상 12개:

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` · `OPENROUTER_API_KEY` · `OPENROUTER_MODEL` · `AWS_REGION` · `AMPLIFY_BUCKET` ·
`AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` · `NEXT_PUBLIC_AWS_S3_BASE_URL` · `QSP_API_HOST` ·
`MUSBI_API_HOST` · `ENABLE_API_DOCS` · `ALLOWED_ORIGIN`

> ⚠️ **새 환경변수를 추가하면 이 스테이지에 검증 라인을 반드시 같이 추가한다.**
> 빠뜨리면 값이 비어 있어도 배포가 "성공"하고, 런타임에 500(추론/S3) 또는 403(`ALLOWED_ORIGIN` 미설정 시 모든 POST)으로 나타난다.

`REPLICATE_API_TOKEN`, `MUSBI_*_PATH`, `MUSBI_RESULT_HOST` 는 선택값이라 검증하지 않는다.
2026-07-30 OpenRouter 전환으로 `GEMINI_API_KEY` · `GEMINI_MODEL` 검증 2줄이 `OPENROUTER_*` 로 교체됐다.
`pv-common-env` 에 남아 있는 `GEMINI_*` 는 **검증하지 않는 여분 키**라 파이프라인을 실패시키지 않는다 — 롤백 대비로 의도적으로 남겨둔 것이다.
마지막 `docker compose version` 은 에이전트에 compose v2 가 있는지 확인하는 스모크 체크다.

### 3.4 Verify

**두 가지를 하고, 둘의 실패 정책이 다르다.**

**① OKF 번들 신선도 점검 — 비차단**

```sh
bash docs/okf/check.sh || echo '[okf] 경고가 있습니다 — 배포는 계속합니다.'
```

- `pnpm okf:check` 가 아니라 `bash` 로 직접 부른다. **Jenkins 에이전트에 Node 가 없기 때문**이고, `check.sh` 는 bash + git 만 쓴다.
- bash 자체가 없으면 조용히 건너뛴다.
- 긴 `docker build` 로그에 묻히지 않도록 빌드보다 **먼저** 실행한다.
- 문서 문제로 배포를 막지 않는다는 게 명시된 정책이다.

**② 빌드 검증 — 차단**

```sh
docker build --target builder \
  --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=... \
  --build-arg NEXT_PUBLIC_AWS_S3_BASE_URL=... \
  -t "solar-pv-system:verify-${BUILD_NUMBER}" .
docker rmi "solar-pv-system:verify-${BUILD_NUMBER}" || true
```

`builder` 스테이지 안에 `pnpm lint` → `pnpm exec tsc --noEmit` → `pnpm build` 가 들어 있다(§4).
즉 **린트·타입 실패가 곧 이미지 빌드 실패**다. 호스트에 Node·pnpm 을 설치하지 않으려는 설계다.
검증용 태그는 바로 지우지만 **레이어 캐시는 남아서 Deploy 의 `compose build` 가 그대로 재사용**한다 — 그래서 이 중복 빌드가 거의 공짜다.

### 3.5 Deploy

```sh
export IMAGE_TAG="${BUILD_NUMBER}"
KEEP_VERSIONS=2
```

| 단계 | dev | prod |
|------|-----|------|
| 빌드 | `compose --profile dev build app-dev` | `compose --profile prod build app-prod-4000` |
| 태깅 | `:dev-{N}` → `:dev-latest` | `:prod-{N}` → `:prod-latest` |
| 기동 | `up -d --wait app-dev` | `up -d --wait app-prod-4000 app-prod-4001` |
| 정리 | 숫자 태그 최근 2개만 보존 | 동일 |

**`--wait` 가 배포 게이트다.** 컨테이너 healthcheck 가 `healthy` 가 될 때까지 블로킹하고, `unhealthy` 로 끝나면 비0 종료해 스테이지를 실패시킨다.

**prod 는 4001 이 4000 의 이미지를 재사용한다.** `app-prod-4001` 에는 `build:` 섹션이 없고 `image: solar-pv-system:prod-${IMAGE_TAG}` 만 있으므로, 4000 을 먼저 빌드해 태그를 만들어야 4001 이 뜬다. `depends_on` 도 그래서 걸려 있다.

**이미지 정리** — `prune_old_images` 는 `solar-pv-system:{profile}-{숫자}` 형태만 골라 역순 정렬 후 3번째부터 삭제한다. `-latest` 태그와 다른 프로파일 이미지는 정규식에 걸리지 않아 안전하다.

```sh
docker images --format '{{.Repository}}:{{.Tag}}' \
  | grep -E "^solar-pv-system:${profile}-[0-9]+$" \
  | sed "s/^solar-pv-system:${profile}-//" | sort -n -r \
  | tail -n "+3" | sed "s/^/solar-pv-system:${profile}-/" | xargs -r docker rmi || true
```

### 3.6 post { always }

`docker compose --profile dev --profile prod ps` 로 최종 상태를 로그에 남기고 **`.env` 를 삭제**한다.
`set +e` 라 정리 실패가 빌드 결과를 뒤집지 않는다.

> `env_file` 은 **컨테이너 생성 시점에** 읽혀 환경변수로 굳으므로, 기동 후 `.env` 를 지워도 실행 중인 컨테이너에는 영향이 없다.
> 대신 **워크스페이스에 `.env` 가 남지 않으므로**, 이후 수동으로 `docker compose` 를 다시 부르려면 `.env` 를 직접 만들어야 한다(§7 참조).

## 4. 이미지 — `Dockerfile` 4스테이지

```
base    node:20-alpine + corepack pnpm@10
  ├─ deps     package.json + pnpm-lock.yaml → pnpm install --frozen-lockfile
  └─ builder  deps 의 node_modules + 소스 전체
                ARG/ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_AWS_S3_BASE_URL
                RUN pnpm lint
                RUN pnpm exec tsc --noEmit
                RUN pnpm build            → .next/standalone
runner  node:20-alpine (builder 와 별개 베이스)
          NODE_ENV=production, 비루트 nextjs(uid 1001)/nodejs(gid 1001)
          COPY public, .next/standalone, .next/static
          EXPOSE 3000 · PORT=3000 · HOSTNAME=0.0.0.0
          CMD ["node","server.js"]
```

포인트 4개:

1. **의존성 레이어 분리** — `deps` 가 `package.json` + 락파일만 복사하므로 소스만 바뀐 빌드는 `pnpm install` 을 건너뛴다.
2. **검증이 빌드 안에 있다** — CI 스크립트가 아니라 Dockerfile 이 lint/tsc 를 수행한다. 로컬 `docker build` 도 같은 게이트를 통과한다.
3. **`NEXT_PUBLIC_*` 는 빌드타임** — 클라이언트 번들에 문자열로 인라인된다. 값을 바꾸려면 **재시작이 아니라 재빌드**가 필요하다.
4. **`runner` 는 pnpm 없이 뜬다** — `output: "standalone"` 산출물만 복사하므로 이미지가 작고 `node_modules` 가 없다.

`.dockerignore` 가 `node_modules` · `.next` · `.git` · `*.md` · `.env*` 를 제외한다.
→ **빌드 컨텍스트에 `.env` 가 절대 들어가지 않는다.** 시크릿은 오직 `--build-arg`(빌드타임 2개) 와 `env_file`(런타임) 로만 들어온다.

## 5. 런타임 — `docker-compose.yml`

| 서비스 | `profiles:` | 이미지 | 호스트:컨테이너 | 빌드 |
|--------|-------------|--------|-----------------|------|
| `app-dev` | `dev` | `solar-pv-system:dev-${IMAGE_TAG:-latest}` | 4010:3000 | O |
| `app-prod-4000` | `prod` | `solar-pv-system:prod-${IMAGE_TAG:-latest}` | 4000:3000 | O |
| `app-prod-4001` | **없음** | `solar-pv-system:prod-${IMAGE_TAG:-latest}` | 4001:3000 | X (4000 이미지 재사용) |

공통: `env_file: .env` · `NODE_ENV=production` · `restart: unless-stopped` · 공유 healthcheck 앵커.

**헬스체크는 컨테이너 내부에서 수행한다.**

```yaml
x-app-healthcheck: &app-healthcheck
  test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:3000/"]
  interval: 5s      # 최대 대기 ≈ start_period 10s + 12회 × 5s
  timeout: 3s
  retries: 12
  start_period: 10s
```

Jenkins 에이전트가 **DooD(Docker-outside-of-Docker) 컨테이너라 호스트 publish 포트(4000/4010)에 닿지 못한다.**
그래서 `curl localhost:4000` 방식이 아니라 컨테이너 안 busybox `wget` 으로 `127.0.0.1:3000` 을 찌른다.
→ **이 헬스체크를 외부 curl 로 바꾸면 Jenkins 에서 반드시 실패한다.**

> ⚠️ `app-prod-4001` 에는 `profiles:` 키가 없다. compose 에서 프로파일이 없는 서비스는 **항상 대상에 포함**되므로,
> `--profile dev` 로 올릴 때도 딸려올 수 있다. Jenkinsfile 이 서비스명을 명시(`up -d --wait app-dev`)해서 회피하고 있다 —
> 즉 **안전성이 compose 파일이 아니라 파이프라인 호출부에 걸려 있다.** 수동으로 `docker compose --profile dev up -d` 만 치면 4001 이 같이 뜬다.

## 6. 환경변수가 들어가는 경로

```
Jenkins Secret file (pv-common-env, pv-{profile}-env)
        │  cat 병합
        ▼
      .env  (워크스페이스, chmod 600, post 에서 삭제)
        ├── set -a; . ./.env    → 셸 변수 (Validate / Verify / Deploy 스테이지)
        │       └── --build-arg NEXT_PUBLIC_*  → Dockerfile ARG → 클라이언트 번들에 인라인 ★빌드타임
        │       └── compose build.args 의 ${NEXT_PUBLIC_*:?...} 도 같은 값을 읽음
        └── env_file: .env      → 컨테이너 프로세스 환경변수 ★런타임
```

★빌드타임 2개(`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_AWS_S3_BASE_URL`)만 이미지에 굳는다.
나머지는 전부 런타임이라 값 변경 후 컨테이너 재생성으로 반영된다.

키별 용도와 dev/prod 배치는 [`docs/okf/system/configuration.md`](okf/system/configuration.md) 표를 따른다.

## 7. 운영 시나리오

### 배포

Jenkins → 잡 → **Build with Parameters** → `PROFILE` 선택 → Build.
`dev` 는 `dev` 브랜치를 4010 으로, `prod` 는 `main` 브랜치를 4000/4001 로 올린다.

### 로컬에서 파이프라인과 동일하게 재현

```bash
# .env 를 준비한 뒤 (공통 + 프로파일 병합본)
docker build --target builder \
  --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=... \
  --build-arg NEXT_PUBLIC_AWS_S3_BASE_URL=... -t pv-verify .   # = Verify 스테이지

docker compose --profile dev up --build       # 포그라운드
docker compose --profile dev up --build -d    # 백그라운드
docker compose down
```

### 롤백 (수동 — 파이프라인에 스테이지가 없다)

이미지가 빌드번호로 태깅되고 최근 2개가 보존되므로 직전 버전으로 되돌릴 수는 있다.
다만 **파이프라인에 롤백 경로가 구현돼 있지 않고**, `post` 에서 `.env` 가 지워지므로 배포 호스트에서 `.env` 를 복구한 뒤 수동으로 수행해야 한다.

```bash
docker images | grep solar-pv-system          # 보존된 태그 확인 (최근 2개)
IMAGE_TAG=<이전_빌드번호> docker compose --profile prod up -d --wait app-prod-4000 app-prod-4001
```

`--build` 없이 `up` 하면 기존 이미지를 그대로 사용한다. 실제 환경에서 검증된 절차가 아니므로 도입 전 한 번 리허설할 것.

## 8. 알려진 제약

| # | 제약 | 영향 | 완화/대안 |
|---|------|------|-----------|
| 1 | 자동 트리거 없음 (`triggers` 블록 부재) | 푸시해도 배포되지 않는다 | 의도된 수동 게이트. 자동화하려면 `pollSCM`/webhook 추가 |
| 2 | 레지스트리 push 없음 | 배포 호스트 = 빌드 호스트로 고정, 이미지가 로컬 데몬에만 존재 | 다중 호스트로 확장 시 레지스트리 필요 |
| 3 | blue/green 아님 | `up -d` 재생성 중 짧은 순단 | prod 는 4000/4001 2인스턴스지만 **동시에 교체**되므로 무중단은 아니다 |
| 4 | 롤백 스테이지 없음 | 장애 시 수동 복구 | §7 절차 + 보존 2버전 |
| 5 | `app-prod-4001` 에 `profiles:` 없음 | 수동 compose 호출 시 의도치 않게 기동 | Jenkinsfile 은 서비스명 명시로 회피 |
| 6 | 테스트 프레임워크 없음 | 회귀 검증이 lint + tsc + 빌드 성공에 의존 | 현 상태에서 Verify 가 할 수 있는 최대치 |
| 7 | 이미지 보존 2개 | 3버전 이상 되돌릴 수 없다 | `KEEP_VERSIONS` 상수 조정 |
| 8 | `.env` 가 워크스페이스에 평문 존재 (빌드 중) | `chmod 600` + `post` 삭제로 노출 창을 좁힘 | 빌드 컨텍스트에는 `.dockerignore` 로 애초에 안 들어감 |

## 9. 체크리스트 — 새 환경변수를 추가할 때

1. 공통 키면 `pv-common-env`, 환경별이면 `pv-dev-env` / `pv-prod-env` credential 파일에 추가.
2. `NEXT_PUBLIC_*` 이면 추가로 — `Dockerfile` 에 `ARG`/`ENV` 2줄, `docker-compose.yml` 각 서비스 `build.args` 에 1줄,
   Jenkinsfile Verify 스테이지의 `docker build` 에 `--build-arg` 1줄.
3. **무조건** Jenkinsfile `Validate Environment` 에 `: "${VAR:?...}"` 1줄 (전수 검증 정책).
4. [`docs/okf/system/configuration.md`](okf/system/configuration.md) 표 갱신.

3번을 빠뜨리면 값이 없는 채로 배포가 성공하고 런타임 500/403 으로 나타난다.
