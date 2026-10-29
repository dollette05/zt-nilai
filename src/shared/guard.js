// Verifikasi ulang di service: gateway secret + tanda tangan/masa berlaku token.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { GATEWAY_SECRET, JWT_SECRET } = require("./config");

const safeEq = (a = "", b = "") => {
  const x = Buffer.from(String(a)),
    y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
module.exports = function guard(req, res, next) {
  if (!safeEq(req.get("X-Gateway-Secret"), GATEWAY_SECRET))
    return res
      .status(403)
      .json({ error: "Akses langsung ditolak: gateway secret tidak valid" });
  const m = /^Bearer (.+)$/.exec(req.get("Authorization") || "");
  if (!m) return res.status(401).json({ error: "Token tidak ada" });
  try {
    req.auth = jwt.verify(m[1], JWT_SECRET);
  } catch (e) {
    return res
      .status(401)
      .json({ error: "Token tidak valid/kedaluwarsa: " + e.message });
  }
  next();
};
