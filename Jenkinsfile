pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    skipDefaultCheckout(true)
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
        script {
          def targetBranch = params.PROFILE == 'prod' ? 'main' : 'dev'
          echo "PROFILE=${params.PROFILE} → '${targetBranch}' 브랜치를 빌드합니다."
          checkout([
            $class: 'GitSCM',
            branches: [[name: "*/${targetBranch}"]],
            userRemoteConfigs: scm.userRemoteConfigs,
            extensions: scm.extensions,
          ])
        }
      }
    }

    stage('Load Env Credential') {
      steps {
        script {
          def profileCred = params.PROFILE == 'dev'
            ? 'pv-dev-env'
            : 'pv-prod-env'
          withCredentials([
            file(credentialsId: 'pv-common-env', variable: 'ENV_COMMON'),
            file(credentialsId: profileCred,     variable: 'ENV_PROFILE'),
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
          : "${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:?credential pv-common-env에 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가 정의되어 있어야 합니다.}"
          : "${GEMINI_API_KEY:?credential pv-common-env에 GEMINI_API_KEY가 정의되어 있어야 합니다.}"
          : "${GEMINI_MODEL:?credential pv-common-env에 GEMINI_MODEL이 정의되어 있어야 합니다. (AI 지붕 감지 기능 필수)}"
          : "${AWS_REGION:?credential pv-common-env에 AWS_REGION이 정의되어 있어야 합니다.}"
          : "${AMPLIFY_BUCKET:?credential pv-common-env에 AMPLIFY_BUCKET이 정의되어 있어야 합니다.}"
          : "${AWS_ACCESS_KEY_ID:?credential pv-common-env에 AWS_ACCESS_KEY_ID가 정의되어 있어야 합니다.}"
          : "${AWS_SECRET_ACCESS_KEY:?credential pv-common-env에 AWS_SECRET_ACCESS_KEY가 정의되어 있어야 합니다.}"
          : "${NEXT_PUBLIC_AWS_S3_BASE_URL:?credential pv-common-env에 NEXT_PUBLIC_AWS_S3_BASE_URL이 정의되어 있어야 합니다.}"
          : "${QSP_API_HOST:?credential pv-${PROFILE}-env에 QSP_API_HOST가 정의되어 있어야 합니다.}"
          : "${MUSBI_API_HOST:?credential pv-${PROFILE}-env에 MUSBI_API_HOST가 정의되어 있어야 합니다.}"
          : "${ENABLE_API_DOCS:?credential pv-${PROFILE}-env에 ENABLE_API_DOCS(true/false)가 정의되어 있어야 합니다. (API 문서 노출 플래그)}"
          : "${ALLOWED_ORIGIN:?credential pv-${PROFILE}-env에 ALLOWED_ORIGIN(공개 도메인, 쉼표 구분)이 정의되어 있어야 합니다. (프록시 CSRF Origin 허용 목록)}"
          docker compose version
        '''
      }
    }

    stage('Verify') {
      steps {
        sh '''
          set -eu
          set -a; . ./.env; set +a

          # 호스트 Node 불필요 — Dockerfile builder 스테이지에서 lint·tsc·build 를 모두 수행한다.
          # builder 타깃 빌드가 성공하면 검증 통과. 레이어는 Deploy 의 compose build 와 캐시 공유된다.
          docker build \\
            --target builder \\
            --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" \\
            --build-arg NEXT_PUBLIC_AWS_S3_BASE_URL="$NEXT_PUBLIC_AWS_S3_BASE_URL" \\
            -t "solar-pv-system:verify-${BUILD_NUMBER}" \\
            .
          docker rmi "solar-pv-system:verify-${BUILD_NUMBER}" 2>/dev/null || true
        '''
      }
    }

    stage('Deploy') {
      steps {
        sh '''
          set -eu
          set -a; . ./.env; set +a

          export IMAGE_TAG="${BUILD_NUMBER}"
          KEEP_VERSIONS=2

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

          # --wait: 컨테이너 healthcheck(docker-compose.yml)가 healthy 가 될 때까지
          # 블로킹하고, unhealthy 로 끝나면 비0 종료해 스테이지를 실패시킨다.
          if [ "$PROFILE" = "dev" ]; then
            docker compose --profile dev build app-dev
            retag_latest dev
            docker compose --profile dev up -d --wait app-dev
            prune_old_images dev "$KEEP_VERSIONS"
          else
            docker compose --profile prod build app-prod-4000
            retag_latest prod
            docker compose --profile prod up -d --wait app-prod-4000 app-prod-4001
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
