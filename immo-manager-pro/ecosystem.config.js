module.exports = {
  apps: [
    {
      name: 'immo-backend',
      cwd: './server',
      script: 'server.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 2000,
      max_restarts: 20,
      exp_backoff_restart_delay: 100,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      disable_logs: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ],

  // Configuration pour déploiement VPS
  deploy: {
    production: {
      user: 'root',
      host: [process.env.DEPLOY_HOST || 'localhost'],
      ref: 'origin/main',
      repo: 'TON_REPO_GIT',
      path: '/var/www/immo-manager',
      'post-deploy': 'cd server && npm install && cd ../client && npm install && npm run build && cd .. && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install -y nodejs npm git',
      'post-setup': 'npm install pm2 -g && mkdir -p logs'
    }
  }
}
