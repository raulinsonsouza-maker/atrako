/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "symbius-central",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 5010",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: "5010",
      },
      autorestart: true,
      max_memory_restart: "1G",
      time: true,
    },
  ],
};
