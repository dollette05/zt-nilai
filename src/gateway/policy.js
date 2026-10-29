// Policy Engine: keputusan allow/deny + alasan, berdasarkan Tabel 3 dan atribut di database.
const { db } = require("../shared/db");
const { ACCESS_START, ACCESS_END } = require("../shared/config");

const allow = (reason = "sesuai kebijakan") => ({ allow: true, reason });
const deny = (reason) => ({ allow: false, reason });
const { TIMEZONE } = require("../shared/config");
const nowHour = () =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: TIMEZONE,
    }).format(new Date()),
  ) % 24;
const inHours = () => {
  const h = nowHour();
  return h >= ACCESS_START && h < ACCESS_END;
};
const hoursMsg = `di luar jam akses (${ACCESS_START}:00-${ACCESS_END}:00)`;

function decide({ method, path, query = {}, auth }) {
  const { sub, role } = auth;
  let m;

  if (method === "GET" && path === "/nilai") {
    if (role === "mahasiswa") {
      const nim = db.prepare("SELECT nim FROM users WHERE id=?").get(sub)?.nim;
      if (query.nim && query.nim !== nim)
        return deny("mahasiswa hanya boleh melihat nilai miliknya");
      return allow("mahasiswa melihat nilai sendiri");
    }
    if (role === "dosen") {
      if (query.kelas_id) {
        const k = db
          .prepare("SELECT dosen_id FROM kelas WHERE id=?")
          .get(query.kelas_id);
        if (!k || k.dosen_id !== sub)
          return deny("kelas bukan yang diampu dosen");
      }
      return allow("dosen melihat kelas yang diampu");
    }
    return deny(`role ${role} tidak boleh melihat nilai`);
  }

  if (method === "PUT" && (m = /^\/nilai\/(\d+)$/.exec(path))) {
    if (role !== "dosen") return deny("hanya dosen yang boleh mengubah nilai");
    const row = db
      .prepare(
        "SELECT n.final, k.dosen_id FROM nilai n JOIN kelas k ON k.id=n.kelas_id WHERE n.id=?",
      )
      .get(m[1]);
    if (!row) return deny("nilai tidak ditemukan");
    if (row.dosen_id !== sub) return deny("kelas bukan yang diampu dosen");
    if (row.final) return deny("nilai sudah final");
    if (!inHours()) return deny(hoursMsg);
    return allow("dosen pengampu mengubah nilai");
  }

  if (method === "POST" && (m = /^\/kelas\/([^/]+)\/finalisasi$/.exec(path))) {
    if (role !== "dosen") return deny("hanya dosen yang boleh finalisasi");
    const k = db.prepare("SELECT dosen_id FROM kelas WHERE id=?").get(m[1]);
    if (!k || k.dosen_id !== sub) return deny("kelas bukan yang diampu dosen");
    if (!inHours()) return deny(hoursMsg);
    return allow("dosen pengampu memfinalisasi kelas");
  }

  if (method === "GET" && (m = /^\/transkrip\/([^/]+)$/.exec(path))) {
    if (role === "admin") return allow("admin melihat semua transkrip");
    if (role === "mahasiswa") {
      const nim = db.prepare("SELECT nim FROM users WHERE id=?").get(sub)?.nim;
      return nim === m[1]
        ? allow("mahasiswa melihat transkrip sendiri")
        : deny("mahasiswa hanya boleh NIM sendiri");
    }
    return deny(`role ${role} tidak boleh melihat transkrip`);
  }

  if (method === "POST" && path === "/transkrip/sinkron")
    return role === "service"
      ? allow("token service valid")
      : deny("hanya token service yang boleh sinkron");

  return deny("endpoint tidak ada dalam kebijakan (default deny)");
}
module.exports = { decide };
