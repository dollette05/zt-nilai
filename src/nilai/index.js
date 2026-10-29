const express = require("express");
const guard = require("../shared/guard");
const { db } = require("../shared/db");
const C = require("../shared/config");
const app = express();
app.use(express.json());
app.use(guard); 

let svc = { token: null, exp: 0 };
async function serviceToken() {
  if (svc.token && Date.now() < svc.exp) return svc.token;
  const r = await fetch(`${C.GATEWAY_URL}/auth/service`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: "service-nilai",
      client_secret: process.env.SERVICE_SECRET || "nilai-secret-123",
    }),
  });
  if (!r.ok) throw new Error("gagal mengambil token service");
  const j = await r.json();
  svc = { token: j.access_token, exp: Date.now() + (j.expires_in - 30) * 1000 };
  return svc.token;
}

app.get("/nilai", (req, res) => {
  const { sub, role } = req.auth; 
  if (role === "mahasiswa") {
    const nim = db.prepare("SELECT nim FROM users WHERE id=?").get(sub)?.nim;
    return res.json(db.prepare("SELECT * FROM nilai WHERE nim=?").all(nim));
  }
  if (role === "dosen") {
    const q = req.query.kelas_id;
    const sql =
      "SELECT n.* FROM nilai n JOIN kelas k ON k.id=n.kelas_id WHERE k.dosen_id=?" +
      (q ? " AND n.kelas_id=?" : "");
    return res.json(db.prepare(sql).all(...(q ? [sub, q] : [sub])));
  }
  res.status(403).json({ error: "role tidak diizinkan" });
});

app.put("/nilai/:id", (req, res) => {
  if (req.auth.role !== "dosen")
    return res.status(403).json({ error: "hanya dosen" });
  const v = Number(req.body?.nilai);
  if (!Number.isFinite(v) || v < 0 || v > 100)
    return res.status(400).json({ error: "nilai harus 0-100" });
  const row = db
    .prepare(
      "SELECT n.final, k.dosen_id FROM nilai n JOIN kelas k ON k.id=n.kelas_id WHERE n.id=?",
    )
    .get(req.params.id);
  if (!row || row.dosen_id !== req.auth.sub || row.final)
    return res.status(403).json({ error: "tidak diizinkan" });
  db.prepare("UPDATE nilai SET nilai=? WHERE id=?").run(v, req.params.id);
  res.json({ id: Number(req.params.id), nilai: v });
});

app.post("/kelas/:id/finalisasi", async (req, res) => {
  if (req.auth.role !== "dosen")
    return res.status(403).json({ error: "hanya dosen" });
  const k = db.prepare("SELECT * FROM kelas WHERE id=?").get(req.params.id);
  if (!k || k.dosen_id !== req.auth.sub)
    return res.status(403).json({ error: "kelas bukan yang diampu" });
  const grades = db
    .prepare("SELECT nim, nilai FROM nilai WHERE kelas_id=?")
    .all(k.id);
  try {
    const r = await fetch(`${C.GATEWAY_URL}/transkrip/sinkron`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await serviceToken()}`,
      },
      body: JSON.stringify({ kelas_id: k.id, mata_kuliah: k.nama, grades }),
    });
    if (!r.ok)
      return res
        .status(502)
        .json({ error: "sinkron transkrip gagal", detail: await r.text() });
    db.prepare("UPDATE nilai SET final=1 WHERE kelas_id=?").run(k.id);
    res.json({
      message: `Kelas ${k.id} difinalisasi dan disinkronkan ke transkrip`,
      jumlah: grades.length,
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.listen(C.NILAI_PORT, () => console.log(`Service Nilai :${C.NILAI_PORT}`));
