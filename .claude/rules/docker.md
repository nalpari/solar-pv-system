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
