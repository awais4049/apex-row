pipeline {
  agent any
  triggers { githubPush() }

  stages {
    stage('Fetch Code') {
      steps {
        git branch: 'main', url: 'https://github.com/awais4049/apex-row.git'
      }
    }
    stage('Build in Container') {
      steps {
        script {
          docker.image('node:18-alpine').inside('-e HOME=/tmp') {
            sh 'npm install'
          }
        }
      }
    }
    stage('Deploy') {
      steps {
        sh 'docker compose -f docker-compose.jenkins.yml -p apexci down || true'
        sh 'docker compose -f docker-compose.jenkins.yml -p apexci up -d'
      }
    }
    stage('Verify') {
      steps {
        sh 'sleep 45 && curl -f http://localhost:8100 > /dev/null'
      }
    }
  }

  post {
    always {
      emailext(
        subject: "Build #${env.BUILD_NUMBER} - ${currentBuild.currentResult}",
        body: "Job: ${env.JOB_NAME}\nResult: ${currentBuild.currentResult}\nLog: ${env.BUILD_URL}console",
        to: 'qasimalik@gmail.com',
        recipientProviders: [[$class: 'DevelopersRecipientProvider'], [$class: 'RequesterRecipientProvider']]
      )
    }
  }
}