---
type: Log
title: solar-pv-system 번들 히스토리
---

# Bundle history

## 2026-07-27 (4)

- **발견 경로 자동화** — `.claude/hooks/okf-hint.py` 추가 (PreToolUse / `Read|Edit|MultiEdit`).
  소스 파일 접근 직전 해당 파일을 인용하는 개념 문서를 지목한다. 기존에는 `CLAUDE.md` 의
  두 줄에만 의존해 에이전트가 스킵하면 그만이었다.
- **정확도** — 단순 문자열 검색은 본문에서 파일명을 언급만 한 문서(`index.md` 예시, `log.md` 이력)까지
  잡아서, frontmatter 의 `resource:` 줄만 정확히 매칭하도록 좁혔다.
- **비용** — 매 Read 마다 도는 훅이라 bash+python3+grep 3프로세스를 python3 1개로 합쳤다 (90ms → 36ms).

## 2026-07-27 (3)

- **CI 연동** — Jenkinsfile `Verify` 스테이지에서 `bash docs/okf/check.sh` 를 비차단(`|| true`)으로 실행.
  에이전트에 Node 가 없어 `pnpm` 이 아닌 `bash` 로 직접 호출하고, bash 가 없으면 건너뛴다.
  [`system/deployment.md`](system/deployment.md) 의 Verify 절을 함께 갱신하고 `verified` 를 부여
  (machine-confirmed — 사람 검토 시 `human:<id>` 로 교체할 것).
- **점검 정확도 수정** — ① 최상위 `resource` 와 `sources[].resource` 가 같을 때 중복 보고되던 것 `sort -u` 로 제거.
  ② 비교 단위를 시각 → **날짜**로 변경. 문서를 고치고 같은 날 커밋하면 커밋 시각이 항상 더 나중이라
  커밋 직후 곧바로 STALE 이 뜨는 문제가 있었다.

## 2026-07-27 (2)

- **신선도 점검 도입** — `docs/okf/check.sh` + `pnpm okf:check`. BROKEN(포인터 깨짐, exit 1) /
  STALE(소스 커밋이 문서 기준시각보다 새로움) / EXPIRED(`stale_after` 경과) 세 판정.
  기준시각은 frontmatter 의 최신 `at:` 값이라 `verified` 를 추가하면 STALE 이 해제된다.
- **중복 문서 정리** — `.claude/rules/utils.md` 와 `components.md` 를 요약 복제에서 okf 포인터로 축소.
  `CLAUDE.md` 에 "도메인·아키텍처는 okf 가 진실의 원천" 우선순위와 PR 규율(역방향 grep) 명시.
- **순환 인용 제거** — 위 두 룰 파일을 `sources` 로 인용하던 3개 문서
  (`modules/panel-placement.md`, `modules/merge-polygons.md`, `domain/coordinate-systems.md`)를
  실제 코드 출처로 교체. 축소된 룰 파일은 더 이상 지식의 출처가 아니다.
- **CLAUDE.md 오기 수정** — 존재하지 않는 언어 토글 서술을 코드 사실로 교체(2곳).

## 2026-07-27

- **Bootstrapped** — 저장소 커밋 `127fabf` 시점의 `src/**` 소스, `CLAUDE.md`, `docs/**` 를 근거로
  `claude-code/opus-5` 가 30개 개념을 생성. 전 문서 신뢰 등급 unverified.
- **stale_after 지정** — [`modules/ai-roof-detection.md`](modules/ai-roof-detection.md) 와
  [`interfaces/detect-roof.md`](interfaces/detect-roof.md) 는 OpenRouter 전환 계획
  (`docs/plans/2026-07-27-gemini-to-openrouter-migration.md`, 설계 확정 / 구현 미착수)이 착수되는 순간
  provider 서술이 무효화되므로 `stale_after: 2026-10-27` 을 부여.
- **불일치 기록** — `CLAUDE.md` 의 언어 토글 서술이 코드와 어긋남을
  [`system/solar-pv-system.md`](system/solar-pv-system.md) 및 번들 루트 index 에 명시.
