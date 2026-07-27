---
okf_version: "0.2"
---

# Solar PV System — 지식 번들

Google Maps 위성영상 위에서 지붕 태양광 모듈 배치를 설계하는 단일 페이지 웹 앱의 OKF 번들.
코드를 읽어도 나오지 않는 것 — 도메인 규칙, 좌표계 규약, 외부 시스템 계약, 배포 전제, "왜 이렇게 했는가" — 를 개념 단위로 기록한다.

# 하위 디렉터리

* [system](system/index.md) - 시스템 개요·배포·설정·보안 경계.
* [domain](domain/index.md) - 지붕면·처마·경사(寸)·배치 규칙 등 이 도메인에서만 통하는 개념.
* [modules](modules/index.md) - 코드 모듈과 각자의 책임·불변식.
* [interfaces](interfaces/index.md) - HTTP 엔드포인트 계약.
* [workflows](workflows/index.md) - 사용자 작업 흐름과 상태 전이.

# 번들 규약

* `resource` 와 `sources[].resource` 의 경로는 **저장소 루트 기준 상대 경로**(`src/...`, `docs/...`)다.
  `/` 로 시작하는 경로는 번들 내부 문서를 가리킨다(`/domain/roof-face.md`).
* 코드가 SSOT 인 값(상수·zod 스키마·매핑 테이블)은 여기서 재정의하지 않고 **위치를 가리킨다**.
  값을 옮겨 적은 곳은 반드시 `sources` 로 출처를 남긴다 — 코드가 바뀌면 이 문서가 틀린다는 뜻이다.
* 신뢰 등급(OKF §5.3): `verified` 없음 → **unverified**, 비인간 actor 만 → **machine-confirmed**,
  `human:<id>` 포함 → **human-reviewed**. 현재 `system/deployment.md` 만 machine-confirmed 이고 나머지는 unverified 다.
  사람이 검토했다면 `verified: { by: human:<id>, at: <ISO8601> }` 를 추가할 것 — 등급이 오르고 STALE 판정도 해제된다.

# 유지보수

**신선도 점검** — `pnpm okf:check` (= `docs/okf/check.sh`). git 만 쓰므로 비용이 없다.

| 판정 | 의미 | 조치 |
|------|------|------|
| `BROKEN` | `resource` 가 가리키는 파일이 없다 | **확실히 틀린 문서다.** 고치거나 `status: draft` (exit 1) |
| `STALE` | 소스의 마지막 커밋일이 문서 기준일보다 **하루 이상** 새롭다 | 사람이 확인. 맞으면 `verified` 추가로 해제 |
| `EXPIRED` | `stale_after` 가 지났다 | 재검증 후 날짜 갱신 또는 제거 |

기준일은 frontmatter 안 `at:` 값 중 **가장 최근 것의 날짜 부분**이다 (문서를 고친 당일 커밋이 곧바로 STALE 로 뜨지 않도록 날짜 단위로 비교한다).
사람이 검토하고 `verified: { by: human:<id>, at: <ISO8601> }` 를 추가하면 판정이 자동으로 풀리고
신뢰 등급도 unverified → human-reviewed 로 올라간다.

**역방향 확인** — 어떤 코드를 고치면 어떤 개념이 걸리는지:

```sh
grep -rl "src/app/utils/panelPlacement.ts" docs/okf/
```

`src/**` 를 수정한 PR 은 이 결과를 리뷰 체크리스트로 삼는다.
