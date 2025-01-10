// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "law-suscription-bot",
      script: "index.js",
      watch: false,
      ignore_watch: [
        "node_modules",
        "src/logs",
        ".env",
        ".env.production",
        ".env.development",
        ".git",
      ], // Excluye la carpeta de logs y node_modules
      env: {
        PORT: 8000,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
      },
      node_args: "--dns-result-order=ipv4first",
    },
  ],
};
