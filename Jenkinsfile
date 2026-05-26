pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  parameters {
    choice(
      name: 'PROFILE',
      choices: ['dev', 'prod'],
      description: '배포 프로파일입니다. dev는 4010, prod는 4000/4001 포트로 배포합니다.'
    )
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Load Env Credential') {
      steps {
        script {
          def profileCred = params.PROFILE == 'dev'
            ? 'pv-simulation-env-dev'
            : 'pv-simulation-env-prod'
          withCredentials([
            file(credentialsId: 'pv-simulation-env-common', variable: 'ENV_COMMON'),
            file(credentialsId: profileCred,                variable: 'ENV_PROFILE'),
          ]) {
            sh '''
              set -eu
              cat "$ENV_COMMON" > .env
              printf '\\n' >> .env
              cat "$ENV_PROFILE" >> .env
              chmod 600 .env
            '''
          }
        }
      }
    }

    stage('Validate Environment') {
      steps {
        sh '''
          set -eu
          set -a; . ./.env; set +a
          : "${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:?credential pv-simulation-env-common에 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가 정의되어 있어야 합니다.}"
          : "${GEMINI_API_KEY:?credential pv-simulation-env-common에 GEMINI_API_KEY가 정의되어 있어야 합니다.}"
          : "${GEMINI_MODEL:?credential pv-simulation-env-common에 GEMINI_MODEL이 정의되어 있어야 합니다. (AI 지붕 감지 기능 필수)}"
          : "${AWS_REGION:?credential pv-simulation-env-common에 AWS_REGION이 정의되어 있어야 합니다.}"
          : "${AMPLIFY_BUCKET:?credential pv-simulation-env-common에 AMPLIFY_BUCKET이 정의되어 있어야 합니다.}"
          : "${AWS_ACCESS_KEY_ID:?credential pv-simulation-env-common에 AWS_ACCESS_KEY_ID가 정의되어 있어야 합니다.}"
          : "${AWS_SECRET_ACCESS_KEY:?credential pv-simulation-env-common에 AWS_SECRET_ACCESS_KEY가 정의되어 있어야 합니다.}"
          : "${NEXT_PUBLIC_AWS_S3_BASE_URL:?credential pv-simulation-env-common에 NEXT_PUBLIC_AWS_S3_BASE_URL이 정의되어 있어야 합니다.}"
          : "${QSP_API_HOST:?credential pv-simulation-env-${PROFILE}에 QSP_API_HOST가 정의되어 있어야 합니다.}"
          : "${ENABLE_API_DOCS:?credential pv-simulation-env-${PROFILE}에 ENABLE_API_DOCS(true/false)가 정의되어 있어야 합니다. (API 문서 노출 플래그)}"
          docker compose version
          node --version
          pnpm --version || corepack prepare pnpm@10 --activate
        '''
      }
    }

    stage('Install') {
      steps {
        sh '''
          set -eu
          corepack enable
          corepack prepare pnpm@10 --activate
          pnpm install --frozen-lockfile
        '''
      }
    }

    stage('Verify') {
      steps {
        sh '''
          set -eu
          set -a; . ./.env; set +a
          pnpm lint
          pnpm exec tsc --noEmit
          pnpm build
        '''
      }
    }

    stage('Deploy') {
      steps {
        sh '''
          set -eu
          set -a; . ./.env; set +a

          export IMAGE_TAG="${BUILD_NUMBER}"
          KEEP_VERSIONS=5

          wait_for_url() {
            url="$1"
            for attempt in $(seq 1 30); do
              if curl -fsS "$url" >/dev/null; then
                return 0
              fi
              sleep 2
            done

            echo "Timed out waiting for $url"
            return 1
          }

          retag_latest() {
            profile="$1"
            docker tag "solar-pv-system:${profile}-${IMAGE_TAG}" "solar-pv-system:${profile}-latest"
          }

          prune_old_images() {
            profile="$1"
            keep="$2"
            skip=$((keep + 1))
            docker images --format '{{.Repository}}:{{.Tag}}' \\
              | grep -E "^solar-pv-system:${profile}-[0-9]+$" \\
              | sed "s/^solar-pv-system:${profile}-//" \\
              | sort -n -r \\
              | tail -n "+${skip}" \\
              | sed "s/^/solar-pv-system:${profile}-/" \\
              | xargs -r docker rmi 2>/dev/null || true
          }

          if [ "$PROFILE" = "dev" ]; then
            docker compose --profile dev build app-dev
            retag_latest dev
            docker compose --profile dev up -d app-dev
            wait_for_url http://localhost:4010
            prune_old_images dev "$KEEP_VERSIONS"
          else
            docker compose --profile prod build app-prod-4000
            retag_latest prod
            docker compose --profile prod up -d app-prod-4000 app-prod-4001
            wait_for_url http://localhost:4000
            wait_for_url http://localhost:4001
            prune_old_images prod "$KEEP_VERSIONS"
          fi
        '''
      }
    }
  }

  post {
    always {
      sh '''
        set +e
        docker compose --profile dev --profile prod ps || true
        rm -f .env
      '''
    }
  }
}
