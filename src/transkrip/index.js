const express = require("express");
const guard = require("../shared/guard");
const { db } = require("../shared/db");
const C = require("../shared/config");
const app = express();
app.use(express.json());
app.use(guard);

app.get("/transkrip/:nim", (req, res) => {
  const { sub, role } = req.auth;
  if (role === "mahasiswa") {
    const nim = db.prepare("SELECT nim FROM users WHERE id=?").get(sub)?.nim;
    if (nim !== req.params.nim)
      return res.status(403).json({ error: "bukan NIM sendiri" });
  } else if (role !== "admin")
    return res.status(403).json({ error: "role tidak diizinkan" });
  res.json(
    db.prepare("SELECT * FROM transkrip WHERE nim=?").all(req.params.nim),
  );
});

app.post("/transkrip/sinkron", (req, res) => {
  if (req.auth.role !== "service")
    return res.status(403).json({ error: "hanya token service" });
  const { kelas_id, mata_kuliah, grades } = req.body || {};
  if (!kelas_id || !Array.isArray(grades))
    return res.status(400).json({ error: "payload tidak valid" });
  const up = db.prepare(
    "INSERT INTO transkrip VALUES(?,?,?,?) ON CONFLICT(nim,kelas_id) DO UPDATE SET nilai=excluded.nilai",
  );
  db.transaction(() =>
    grades.forEach((g) => up.run(g.nim, kelas_id, mata_kuliah, g.nilai)),
  )();
  res.json({ message: "sinkron berhasil", jumlah: grades.length });
});

app.listen(C.TRANSKRIP_PORT, () =>
  console.log(`Service Transkrip :${C.TRANSKRIP_PORT}`),
);
