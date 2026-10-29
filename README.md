# Sistem Nilai: Zero Trust Security

Tugas Praktikum Keamanan Informasi (KP70065004), Informatika Universitas Siliwangi.
Naura Aulia Putri, 247006111002
Stack: Node.js 18+ (diuji di 22), Express, http-proxy-middleware, jsonwebtoken, SQLite (better-sqlite3).

## Menjalankan

```bash
npm install
npm start          # gateway :3000, service nilai :3001, service transkrip :3002 (DB dan seed dibuat otomatis)
npm run test:api   # pengujian otomatis (curl), jalankan di terminal lain
npm run audit      # lihat 30 audit log terakhir
npm run reset      # hapus database
```

Jam akses (default 07.00-21.00 WIB) dapat diubah untuk demo:
`ACCESS_START=0 ACCESS_END=24 npm start` (selalu buka) atau `ACCESS_START=3 ACCESS_END=3 npm start` (selalu tutup).
Zona waktu: `TZ_APP` (default `Asia/Jakarta`). Secret: `JWT_SECRET`, `GATEWAY_SECRET`, `SERVICE_SECRET`.

## Akun seed (password semua: `password123`)

| Username | Role                                | NIM     | Device ID  |
| -------- | ----------------------------------- | ------- | ---------- |
| admin1   | admin                               | -       | dev-admin1 |
| dosen1   | dosen (kelas K1 Keamanan Informasi) | -       | dev-dosen1 |
| dosen2   | dosen (kelas K2 Basis Data)         | -       | dev-dosen2 |
| mhs1     | mahasiswa                           | 2020001 | dev-mhs1   |
| mhs2     | mahasiswa                           | 2020002 | dev-mhs2   |
| mhs3     | mahasiswa                           | 2020003 | dev-mhs3   |

Service Nilai: client ID `service-nilai`, secret `nilai-secret-123`.
Nilai awal: id 1,3,5 = kelas K1 (mhs1..3); id 2,4,6 = kelas K2.

## Contoh curl

```bash
curl -X POST localhost:3000/auth/login -H "Content-Type: application/json" -H "X-Device-ID: dev-dosen1" \
  -d '{"username":"dosen1","password":"password123"}'
curl -X PUT localhost:3000/nilai/1 -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" \
  -H "X-Device-ID: dev-dosen1" -d '{"nilai":95}'
curl -X POST localhost:3000/kelas/K1/finalisasi -H "Authorization: Bearer <TOKEN>" -H "X-Device-ID: dev-dosen1"
```

## Pemetaan kebutuhan ke kode (untuk video demo)

| Kebutuhan                                                        | Lokasi                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Gateway sebagai PEP, satu-satunya pintu masuk                    | `src/gateway/index.js` (middleware `pep`, proxy)                                    |
| Policy Engine allow/deny + alasan (Tabel 3, baca atribut DB)     | `src/gateway/policy.js` (`decide`)                                                  |
| Login, JWT 10 menit, refresh token 1 hari di DB, logout mencabut | `src/gateway/auth.js` (`login`, `refresh`, `logout`)                                |
| Token service 5 menit, role `service`                            | `src/gateway/auth.js` (`service`), diambil di `src/nilai/index.js` (`serviceToken`) |
| Gateway secret (`X-Gateway-Secret`)                              | ditambah di `proxyReq` pada gateway, diverifikasi di `src/shared/guard.js`          |
| Verifikasi ulang token di service                                | `src/shared/guard.js` + pengecekan kepemilikan di tiap service                      |
| Device terdaftar (`X-Device-ID`)                                 | `src/gateway/auth.js` (login) dan `pep` (tiap request)                              |
| Jam akses 07.00-21.00 (konfigurasi)                              | `src/shared/config.js` + `inHours` di `policy.js`                                   |
| Finalisasi memanggil sinkron transkrip lewat gateway             | `src/nilai/index.js` (`POST /kelas/:id/finalisasi`)                                 |
| `/transkrip/sinkron` hanya token service                         | `policy.js` dan `src/transkrip/index.js`                                            |
| Audit log (waktu, subjek, endpoint, device, hasil, alasan)       | fungsi `audit` di gateway, tabel `audit_log`                                        |

## Catatan desain

- Default deny: endpoint yang tidak ada di kebijakan ditolak.
- Pertahanan berlapis (assume breach): service tidak percaya gateway begitu saja. Mereka memeriksa secret, tanda tangan token, dan memfilter ulang data berdasarkan token.
- Password di-hash dengan scrypt, refresh token disimpan sebagai SHA-256, secret service di-hash.
- Finalisasi: nilai baru ditandai final setelah sinkron ke transkrip berhasil.
