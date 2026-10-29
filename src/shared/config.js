const path = require("path");
module.exports = {
  GATEWAY_PORT: 3000,
  NILAI_PORT: 3001,
  TRANSKRIP_PORT: 3002,
  GATEWAY_URL: "http://localhost:3000",
  NILAI_URL: "http://localhost:3001",
  TRANSKRIP_URL: "http://localhost:3002",
  JWT_SECRET: process.env.JWT_SECRET || "ganti-jwt-secret-ini",
  GATEWAY_SECRET: process.env.GATEWAY_SECRET || "ganti-gateway-secret-ini",
  ACCESS_TTL: "10m",
  SERVICE_TTL: "5m",
  REFRESH_TTL_MS: 24 * 60 * 60 * 1000,
  ACCESS_START: Number(process.env.ACCESS_START ?? 7),
  ACCESS_END: Number(process.env.ACCESS_END ?? 21),
  TIMEZONE: process.env.TZ_APP || "Asia/Jakarta",
  DB_FILE: process.env.DB_FILE || path.join(__dirname, "../../data/app.db"),
};
