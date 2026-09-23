/**
 * PM2 ecosystem - CRM na VPS
 * Uso: pm2 start ecosystem.config.js
 *
 * Se o prospectads ou outro app usar porta 3000, o crm-app usa 3001.
 * Atualize o Nginx para proxy_pass http://127.0.0.1:3001 nesse caso.
 */
module.exports = {
  apps: [
    {
      name: "crm-app",
      script: "node_modules/.bin/next",
      args: "start -p 3001",
      cwd: "/var/www/crm",
      env_file: "/var/www/crm/.env",
      instances: 1,
      autorestart: true,
      merge_logs: true,
    },
    {
      name: "crm-worker",
      script: "jobs/worker.js",
      cwd: "/var/www/crm",
      env_file: "/var/www/crm/.env",
      instances: 1,
      autorestart: true,
      merge_logs: true,
    },
  ],
};
