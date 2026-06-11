# graphify 설치 가이드

이 프로젝트에는 [graphify](https://github.com/safishamsi/graphify) — Claude Code 등 AI 코딩 어시스턴트용 **지식 그래프 스킬** — 이 통합되어 있습니다. 코드/문서/이미지를 분석하여 god 노드, 커뮤니티 구조, 의존 관계를 그래프로 만들고, Claude가 raw 파일을 grep 하기 전에 그래프를 먼저 참조하도록 합니다.

이 문서는 macOS 환경에서 팀원이 동일한 환경을 재현할 수 있도록 실제 설치 과정을 정리한 것입니다.

---

## 결과물 개요

설치가 끝나면 다음 상태가 됩니다.

- **글로벌**
  - `uv` (Homebrew로 설치, Python/도구 관리자)
  - `graphifyy` Python 패키지 (uv가 격리된 Python 3.10+ 환경에 자동 설치)
  - `~/.local/bin/graphify` CLI
  - `~/.claude/skills/graphify/SKILL.md` (Claude Code 스킬)
  - `~/.claude/CLAUDE.md` (`/graphify` 트리거 등록 블록 추가)
- **이 프로젝트**
  - `CLAUDE.md`에 graphify 사용 규칙 섹션 추가
  - `.claude/settings.json`에 `PreToolUse` 훅 등록 (Bash 도구의 grep/find 호출 직전 그래프 안내 주입)

---

## 사전 요구사항

| 항목 | 비고 |
|------|------|
| macOS (Apple Silicon / Intel) | Linux 사용자는 [트러블슈팅](#트러블슈팅--다른-os) 참고 |
| Homebrew | `brew --version`으로 확인 |
| Claude Code | 이 프로젝트에서 이미 사용 중 |
| 인터넷 연결 | uv가 Python 인터프리터를 다운로드 |

> **참고:** macOS 시스템 Python은 보통 3.9 입니다. graphify는 **Python 3.10+** 가 필요하지만, 아래 권장 경로(`uv`)를 따르면 시스템 Python을 건드리지 않고 격리된 Python 3.10이 자동으로 설치됩니다.

---

## 설치 단계

### 1. uv 설치

```bash
brew install uv
uv --version   # 동작 확인 (예: uv 0.11.x)
```

### 2. graphifyy 패키지 설치

```bash
uv tool install graphifyy
```

진행 중 `cpython-3.10.20-macos-aarch64-none` 등의 Python 인터프리터가 자동 다운로드됩니다. 완료되면 `~/.local/bin/graphify`에 CLI가 설치됩니다.

```bash
which graphify   # /Users/<you>/.local/bin/graphify
graphify --help  # 사용 가능한 서브커맨드 확인
```

> **`graphify: command not found`** 가 뜨면 `~/.local/bin`이 PATH에 없는 것입니다. zsh 사용자는 다음을 `~/.zshrc`에 추가:
> ```bash
> export PATH="$HOME/.local/bin:$PATH"
> ```
> 후 `source ~/.zshrc` 또는 새 터미널 세션을 엽니다.

### 3. 글로벌 Claude Code 스킬 등록

```bash
graphify install
```

수행 결과:
- `~/.claude/skills/graphify/SKILL.md` 생성
- `~/.claude/CLAUDE.md`에 `_SKILL_REGISTRATION` 블록 추가 (`/graphify` 트리거 활성화)

이 단계까지 끝나면 모든 프로젝트에서 Claude Code에 `/graphify .`을 입력해 그래프를 빌드할 수 있습니다.

### 4. 이 프로젝트에 통합 (always-on)

```bash
cd /path/to/solar-pv-system
graphify claude install
```

수행 결과:
- `CLAUDE.md`에 graphify 사용 규칙 섹션 append
- `.claude/settings.json`에 `PreToolUse` 훅 등록 (`graphify-out/graph.json` 존재 시 grep/find 호출 직전 안내 주입)

이 두 파일은 **이미 main 브랜치에 커밋되어 있으므로**, `git pull`만 받은 팀원은 4단계를 다시 실행할 필요가 없습니다.

---

## 설치 확인

```bash
graphify --help                     # CLI 동작
ls ~/.claude/skills/graphify/       # SKILL.md 존재
cat .claude/settings.json           # PreToolUse 훅 등록 확인
```

Claude Code 새 세션을 시작한 뒤 `/graphify`를 입력했을 때 자동완성에 잡히면 정상입니다.

---

## 사용 방법

### 그래프 빌드

새 Claude Code 세션에서:

```
/graphify .
```

프로젝트 전체를 분석하여 다음을 생성합니다:

```
graphify-out/
├── graph.html       # 인터랙티브 그래프 (브라우저에서 열기)
├── GRAPH_REPORT.md  # 핵심 노드 / 커뮤니티 / 추천 질문
├── graph.json       # 영구 그래프 (재사용 가능)
└── cache/           # SHA256 캐시 (변경된 파일만 재처리)
```

> **첫 빌드는 Claude API 호출이 발생합니다.** 코드만 있는 경우 AST 패스로 대부분 처리되어 비용이 적지만, 마크다운/이미지/문서가 많으면 토큰 사용량이 증가합니다. 추정 비용은 빌드 후 `graphify-out/cost.json`에서 확인 가능합니다.

### 쿼리 명령

```bash
graphify query "LnbDesign이 panelPlacement와 어떻게 연결되어 있나?"
graphify path "MapView" "CropPopup"
graphify explain "placePanelsOnCanvasCm"
graphify ./graphify-out/graph.json --update    # 변경 파일만 재추출
```

### 그래프 갱신

코드 변경 후 그래프를 최신 상태로 유지:

```bash
graphify update .                   # AST 패스만 (LLM 비용 없음)
```

문서/이미지가 변경된 경우는 `/graphify --update`를 Claude Code에서 실행하세요 (LLM 호출 발생).

### 항상-온(Always-On) 동작

이 프로젝트의 `.claude/settings.json`에 등록된 `PreToolUse` 훅이 다음 조건에서 작동합니다:

- Claude가 Bash 도구로 `grep` / `rg` / `find` / `fd` / `ack` / `ag` 명령을 호출하기 직전
- `graphify-out/graph.json` 파일이 존재할 때

이때 다음 안내가 주입됩니다:
> _"graphify: Knowledge graph exists. Read graphify-out/GRAPH_REPORT.md for god nodes and community structure before searching raw files."_

→ Claude가 raw 파일을 grep하는 대신 그래프 구조를 먼저 참조합니다.

---

## graphify-out/ 폴더 git 정책 (권장)

`.gitignore`에 다음을 추가하는 것이 일반적입니다:

```gitignore
# graphify
graphify-out/cache/        # 로컬 캐시
graphify-out/manifest.json # mtime 기반, clone 후 무효
graphify-out/cost.json     # 로컬 토큰 사용량 추적
```

`graph.json` / `GRAPH_REPORT.md` / `graph.html`은 커밋하면 팀원이 별도 빌드 없이 즉시 그래프 컨텍스트를 사용할 수 있습니다. 단, 코드 변경 PR마다 그래프도 함께 갱신·커밋해야 효과가 있으므로 팀 합의 후 결정하세요.

---

## 트러블슈팅 / 다른 OS

### Python 3.10+ 가 없다는 오류

`uv tool install`을 사용했는지 확인하세요. uv는 시스템 Python과 무관하게 자체적으로 Python 3.10+ 인터프리터를 다운로드합니다. `pip install`을 직접 사용한 경우 시스템 Python(3.9)에서 실패할 수 있습니다.

### `graphify: command not found`

`~/.local/bin`을 PATH에 추가하거나, `pipx install graphifyy`(pipx는 PATH 자동 관리)로 재설치하세요.

### Linux

거의 동일하지만 brew 대신 시스템 패키지 매니저로 uv 설치:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv tool install graphifyy && graphify install
```

### Windows

WSL 사용을 권장합니다. 네이티브 Windows에서는 `graphify install --platform windows` 옵션을 사용해야 하며, 자세한 내용은 [공식 README](https://github.com/safishamsi/graphify#install)를 참고하세요.

### 다른 AI 어시스턴트

이 프로젝트는 Claude Code 통합만 설정되어 있습니다. Codex / Cursor / Gemini CLI 등을 함께 쓰는 팀원은 [공식 README의 Platform support](https://github.com/safishamsi/graphify#platform-support) 표를 참고하여 별도 명령(`graphify codex install` 등)으로 추가 통합하세요.

---

## 제거 방법

```bash
# 프로젝트 통합만 제거 (CLAUDE.md / .claude/settings.json 변경 되돌림)
graphify claude uninstall

# 글로벌 스킬 제거
graphify uninstall

# 패키지/CLI 제거
uv tool uninstall graphifyy

# uv 자체를 더 이상 쓰지 않을 때
brew uninstall uv
```

---

## 참고 자료

- [공식 GitHub: safishamsi/graphify](https://github.com/safishamsi/graphify)
- [공식 사이트: graphify.net](https://graphify.net/)
- [DeepWiki: Getting Started](https://deepwiki.com/safishamsi/graphify/1.1-getting-started-and-installation)
