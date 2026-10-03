module.exports = {
  apps: [
    {
      name: "yamtiken-backend",
      script: "cd server && npm start",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "yamtiken-frontend",
      script: "cd client && npx vite preview --port 5173 --host",
      env: {
        NODE_ENV: "production",
      }
    }
  ]
}
