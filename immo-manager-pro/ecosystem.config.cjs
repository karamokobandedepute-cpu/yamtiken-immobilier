module.exports = {
  apps: [
    {
      name: "yamtiken-backend",
      script: "server.js",
      cwd: "./server",
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: "development",
      }
    },
    {
      name: "yamtiken-frontend",
      script: "./node_modules/vite/bin/vite.js",
      cwd: "./client",
      watch: false,
      env: {
        NODE_ENV: "development",
      }
    }
  ]
};
