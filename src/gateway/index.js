// API Gateway = PEP. Satu-satunya pintu masuk (port 3000).
const express = require("express");
const jwt = require("jsonwebtoken");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { db } = require("../shared/db");
const C = require("../shared/config");
const { decide } = require("./policy");
const authH = require("./auth");

const app = express();
const logStmt = db.prepare(
  "INSERT INTO audit_log(waktu,subjek,endpoint,device,hasil,alasan) VALUES(?,?,?,?,?,?)",
);
const audit = (req, subject, ok, reason) => {
  const row = [
    new Date().toISOString(),
    subject,
    `${req.method} ${req.originalUrl}`,
    req.get("X-Device-ID") || "-",
    ok ? "allow" : "deny",
    reason,
  ];
  logStmt.run(...row);
  console.log("[AUDIT]", row.join(" | "));
};

const authRoutes = {
  "/auth/login": authH.login,
  "/auth/refresh": authH.refresh,
  "/auth/logout": authH.logout,
  "/auth/service": authH.service,
};
app.post(Object.keys(authRoutes), express.json(), (req, res) => {
  const r = authRoutes[req.path](req);
  audit(req, r.subject, r.status === 200, r.reason);
  res.status(r.status).json(r.body);
});

const pep = (req, res, next) => {
  const deny = (status, subject, reason) => {
    audit(req, subject, false, reason);
    return res.status(status).json({ error: reason });
  };
  const m = /^Bearer (.+)$/.exec(req.get("Authorization") || "");
  if (!m) return deny(401, "-", "access token tidak ada");
  let auth;
  try {
    auth = jwt.verify(m[1], C.JWT_SECRET);
  } catch (e) {
    return deny(401, "-", "token tidak valid/kedaluwarsa");
  }

  if (auth.role !== "service") {
    const dev = req.get("X-Device-ID");
    const user = db.prepare("SELECT id FROM users WHERE id=?").get(auth.sub);
    if (!user) return deny(401, auth.sub, "user tidak ditemukan");
    if (
      !dev ||
      !db
        .prepare("SELECT 1 FROM devices WHERE user_id=? AND device_id=?")
        .get(auth.sub, dev)
    )
      return deny(403, auth.sub, "device tidak terdaftar untuk user ini");
  }
  const d = decide({
    method: req.method,
    path: req.path.replace(/\/+$/, "") || "/",
    query: req.query,
    auth,
  });
  audit(req, `${auth.sub} (${auth.role})`, d.allow, d.reason);
  if (!d.allow) return res.status(403).json({ error: d.reason });
  next();
};
const proxy = (target, pathFilter) =>
  createProxyMiddleware({
    target,
    pathFilter,
    changeOrigin: true,
    on: { proxyReq: (p) => p.setHeader("X-Gateway-Secret", C.GATEWAY_SECRET) },
  });
const guarded = (prefixes) => (req, res, next) =>
  prefixes.some((p) => req.path === p || req.path.startsWith(p + "/"))
    ? pep(req, res, next)
    : next();
app.use(guarded(["/nilai", "/kelas", "/transkrip"]));
app.use(proxy(C.NILAI_URL, ["/nilai", "/kelas"]));
app.use(proxy(C.TRANSKRIP_URL, ["/transkrip"]));
app.use((req, res) => {
  audit(req, "-", false, "route tidak dikenal");
  res.status(404).json({ error: "Not found" });
});

app.listen(C.GATEWAY_PORT, () =>
  console.log(`Gateway (PEP) :${C.GATEWAY_PORT}`),
);
