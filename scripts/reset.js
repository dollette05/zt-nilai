const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../data");
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith("app.db")) fs.rmSync(path.join(dir, f), { force: true });
  }
}
console.log("Database dihapus. Jalankan npm start untuk membuat data awal.");
