const { DatabaseSync } = require("node:sqlite"); // SQLite bawaan Node 22.13+, tanpa kompilasi
const crypto = require("crypto");
const { DB_FILE } = require("./config");

const raw = new DatabaseSync(DB_FILE);
raw.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;");
const db = {
  prepare: (sql) => raw.prepare(sql),
  exec: (sql) => raw.exec(sql),
  transaction:
    (fn) =>
    (...args) => {
      raw.exec("BEGIN");
      try {
        const r = fn(...args);
        raw.exec("COMMIT");
        return r;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
};

const hash = (pw, salt = crypto.randomBytes(8).toString("hex")) =>
  salt + ":" + crypto.scryptSync(pw, salt, 32).toString("hex");
const verifyHash = (pw, stored) => {
  const [salt, h] = stored.split(":");
  const a = Buffer.from(hash(pw, salt).split(":")[1], "hex"),
    b = Buffer.from(h, "hex");
  return crypto.timingSafeEqual(a, b);
};

db.exec(`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, nama TEXT, password TEXT, role TEXT, nim TEXT);
CREATE TABLE IF NOT EXISTS devices(user_id TEXT, device_id TEXT, PRIMARY KEY(user_id, device_id));
CREATE TABLE IF NOT EXISTS kelas(id TEXT PRIMARY KEY, nama TEXT, dosen_id TEXT);
CREATE TABLE IF NOT EXISTS nilai(id INTEGER PRIMARY KEY AUTOINCREMENT, nim TEXT, kelas_id TEXT, nilai REAL, final INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS transkrip(nim TEXT, kelas_id TEXT, mata_kuliah TEXT, nilai REAL, PRIMARY KEY(nim, kelas_id));
CREATE TABLE IF NOT EXISTS refresh_tokens(token_hash TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER, revoked INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS service_clients(client_id TEXT PRIMARY KEY, secret TEXT, name TEXT);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT, waktu TEXT, subjek TEXT, endpoint TEXT, device TEXT, hasil TEXT, alasan TEXT);
`);

function seed() {
  if (db.prepare("SELECT COUNT(*) c FROM users").get().c) return;
  const u = db.prepare("INSERT INTO users VALUES(?,?,?,?,?)");
  const d = db.prepare("INSERT INTO devices VALUES(?,?)");
  const pw = hash("password123");
  [
    ["admin1", "Admin Prodi", "admin", null],
    ["dosen1", "Dr. Budi", "dosen", null],
    ["dosen2", "Dr. Sari", "dosen", null],
    ["mhs1", "Andi", "mahasiswa", "2020001"],
    ["mhs2", "Bela", "mahasiswa", "2020002"],
    ["mhs3", "Citra", "mahasiswa", "2020003"],
  ].forEach(([id, n, r, nim]) => {
    u.run(id, n, pw, r, nim);
    d.run(id, "dev-" + id);
  });
  db.prepare("INSERT INTO kelas VALUES(?,?,?)").run(
    "K1",
    "Keamanan Informasi",
    "dosen1",
  );
  db.prepare("INSERT INTO kelas VALUES(?,?,?)").run(
    "K2",
    "Basis Data",
    "dosen2",
  );
  const n = db.prepare("INSERT INTO nilai(nim,kelas_id,nilai) VALUES(?,?,?)");
  ["2020001", "2020002", "2020003"].forEach((nim, i) => {
    n.run(nim, "K1", 80 + i * 5);
    n.run(nim, "K2", 70 + i * 5);
  });
  db.prepare("INSERT INTO service_clients VALUES(?,?,?)").run(
    "service-nilai",
    hash("nilai-secret-123"),
    "Service Nilai",
  );
}
seed();
module.exports = { db, hash, verifyHash };
