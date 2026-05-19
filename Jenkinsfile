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
        withCredentials([file(credentialsId: 'pv-simulation-env', variable: 'ENV_FILE')]) {
          sh '''
            set -eu
            cp "$ENV_FILE" .env
            chmod 600 .env
          '''
        }
      }
    }

    stage('Validate Environment') {
      steps {
        sh '''
          set -eu
          set -a; . ./.env; set +a
          : "${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:?credential pv-simulation-env에 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가 정의되어 있어야 합니다.}"
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
