# Formula Rescue — integrated dashboard checkpoint

Tanggal: 2026-09-17. Scope: halaman rescue + tema + request API nyata.

## Yang bekerja

- Sidebar dan kartu dashboard membuka komponen Formula Rescue dalam aplikasi sama.
- Tema putih, biru laut, cyan; form, process trace, Top 3, tabel kandidat berikutnya.
- Kontrak request dan ranking sama dengan Formula Rescue lama.
- Model, dataset, engine, dan FastAPI dalam Hackathon tidak diubah/dilatih ulang.
- Browser memanggil Next.js same-origin, kemudian server memanggil API Vercel lama.
- Empty/error states tidak memakai fallback mock.

## Alasan konektor server

Inspeksi API lama: /health dan /formulas HTTP 200, 294 formula.
GET dengan Origin http://localhost:3000 tidak mengembalikan
Access-Control-Allow-Origin. Karena itu akses langsung browser tidak dipakai.
Konektor bukan workaround autentikasi: data API ini memang demo publik.

## Bukti pengujian

- Backend lama: 22 unittest passed.
- Frontend: typecheck dan production build passed.
- HTTP nyata melalui build Next.js lokal: health 200; 294 formula pada tiga halaman.
- Formula 7 / Plantacare 818 / top_k 8: delapan kandidat; Top 3 288, 292, 190.
- Semua kandidat sample constraint_passed dan historically observed stable.
- Error terkontrol: pagination, unknown endpoint, malformed/null JSON,
  invalid top_k, unknown ingredient, content type, dan batas payload.
- Browser manual belum diuji agent: user harus memverifikasi select, Run, Retry,
  navigasi, responsivitas HP, dan error saat jaringan/backend tidak tersedia.

## Batas dan mitigasi

- Login hanya demo. Tidak ada rate limiting baru atau izin akses per akun.
- Endpoint penghubung fixed, input dibatasi, timeout 45 detik, error disanitasi.
- Perlu rate limiting/resource monitoring sebelum publik yang lebih luas.
- Process trace bukan streaming progress; bukti ditampilkan sesudah respons.
- Stability estimate dan rescue score bukan jaminan physical lab success.
- Hasil belum disimpan ke library; hasil hilang saat fitur di-unmount/refresh.
- Library masih demo, bukan riwayat request rescue nyata.
- Tidak ada push/deployment baru pada tahap ini. Root Spontan-Team belum Git repo.

Predicted / estimated and requires physical laboratory validation.
