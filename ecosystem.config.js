// ecosystem.config.js
module.exports = {
    apps: [
      {
        name: "infobot-main",
        script: "index.js",
        watch: false,
        ignore_watch: ["node_modules", "src/logs", ".env", ".env.production", ".env.development", ".git"], // Excluye la carpeta de logs y node_modules
        env: {
          PORT: 3000,
          NODE_ENV: "production"
        },
      }
    ]
  };