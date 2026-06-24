---
globs:
  - "Dockerfile"
  - "docker-compose*.yml"
  - "docker-compose*.yaml"
  - ".dockerignore"
---

# Docker Rules

- Multi-stage build with standalone output for production deployment
- `docker compose up --build` — build and run containers
- `docker compose down` — stop containers
- 배포 헬스체크는 컨테이너 내부 healthcheck(`x-app-healthcheck`, busybox wget)로 수행 — Jenkins 에이전트가 DooD 컨테이너라 호스트 publish 포트(localhost/호스트 IP)에 닿지 못하므로, Jenkinsfile 은 `docker compose up -d --wait` 로 healthy 를 게이트한다
