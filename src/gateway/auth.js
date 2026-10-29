// Bagian Policy Administrator: login, refresh, logout, token service.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { db, verifyHash } = require("../shared/db");
const C = require("../shared/config");
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const access = (u) =>
  jwt.sign({ sub: u.id, role: u.role }, C.JWT_SECRET, {
    expiresIn: C.ACCESS_TTL,
  });

exports.login = (req) => {
  const { username, password } = req.body || {};
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(username || "");
  if (!u || !verifyHash(password || "", u.password))
    return {
      status: 401,
      body: { error: "Kredensial salah" },
      reason: "kredensial tidak valid",
      subject: username || "-",
    };
  const dev = req.get("X-Device-ID");
  if (
    !dev ||
    !db
      .prepare("SELECT 1 FROM devices WHERE user_id=? AND device_id=?")
      .get(u.id, dev)
  )
    return {
      status: 403,
      body: { error: "Device tidak terdaftar" },
      reason: "device tidak terdaftar",
      subject: u.id,
    };
  const rt = crypto.randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO refresh_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)",
  ).run(sha(rt), u.id, Date.now() + C.REFRESH_TTL_MS);
  return {
    status: 200,
    body: { access_token: access(u), refresh_token: rt, expires_in: 600 },
    reason: "login berhasil",
    subject: u.id,
  };
};
exports.refresh = (req) => {
  const r = db
    .prepare("SELECT * FROM refresh_tokens WHERE token_hash=?")
    .get(sha(req.body?.refresh_token || ""));
  if (!r || r.revoked || r.expires_at < Date.now())
    return {
      status: 401,
      body: { error: "Refresh token tidak valid" },
      reason: "refresh token tidak valid/dicabut/kedaluwarsa",
      subject: r?.user_id || "-",
    };
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(r.user_id);
  return {
    status: 200,
    body: { access_token: access(u), expires_in: 600 },
    reason: "refresh berhasil",
    subject: u.id,
  };
};
exports.logout = (req) => {
  const r = db
    .prepare("SELECT * FROM refresh_tokens WHERE token_hash=?")
    .get(sha(req.body?.refresh_token || ""));
  if (!r || r.revoked)
    return {
      status: 401,
      body: { error: "Refresh token tidak valid" },
      reason: "refresh token tidak valid",
      subject: r?.user_id || "-",
    };
  db.prepare("UPDATE refresh_tokens SET revoked=1 WHERE token_hash=?").run(
    r.token_hash,
  );
  return {
    status: 200,
    body: { message: "Logout, refresh token dicabut" },
    reason: "logout, token dicabut",
    subject: r.user_id,
  };
};
exports.service = (req) => {
  const { client_id, client_secret } = req.body || {};
  const c = db
    .prepare("SELECT * FROM service_clients WHERE client_id=?")
    .get(client_id || "");
  if (!c || !verifyHash(client_secret || "", c.secret))
    return {
      status: 401,
      body: { error: "Client tidak valid" },
      reason: "client id/secret salah",
      subject: client_id || "-",
    };
  const token = jwt.sign({ sub: c.client_id, role: "service" }, C.JWT_SECRET, {
    expiresIn: C.SERVICE_TTL,
  });
  return {
    status: 200,
    body: { access_token: token, expires_in: 300 },
    reason: "token service diterbitkan",
    subject: c.client_id,
  };
};
