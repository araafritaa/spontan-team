# Spontan — frontend demo

Login demo, dashboard tiga modul, dan workflow R&D dalam satu aplikasi.
Formula Rescue sudah diintegrasikan ke API lama dengan tema dashboard.
AI Reformulation belum memiliki hasil model; riwayat library masih fixture demo.

## Dataset Library (UI demo)

- Menu bisa dibuka/ditutup melalui tombol Menu dan Tutup menu.
- Library memiliki Clear Insight, Formula Rescue, AI Reformulation.
- Tiap kategori dapat diurutkan terbaru/terlama; waktu tampil dalam WIB.
- Klik judul kartu untuk membuka Simple Mode: tabel sensory/target atau metrik rescue.
- Session Detail membuka JSON sesi dummy; bukan pembatas izin akses.
- Menu ⋯: download results CSV atau session JSON. File menyertakan label demo.
- Chart baseline/candidate memakai angka dummy; bukan hasil model atau lab.
- Semua sesi adalah fixture demo; belum ada persistence/API atau data privat.
- Checkpoint: buka tiga kategori, balik urutan tanggal, buka/tutup detail,
  kembali Simple Mode, coba menu dan tabel pada layar HP.

## Jalankan di terminal VS Code / PowerShell

```powershell
cd D:\Spontan-Team\frontend
npm ci
npm run dev
```

Buka http://localhost:3000 di browser. Isi username dan password **dummy**.
Password tidak dibaca oleh handler, disimpan, atau dikirim. Nama hanya berada
di state browser, hilang setelah refresh. Ini bukan autentikasi atau pembatas akses.

## Checkpoint manual

1. Input kosong tidak dapat masuk; username berisi spasi menampilkan error.
2. Masuk dengan input dummy, pindah antara tiga menu, lalu Keluar.
3. Coba lebar layar HP; Formula Rescue memakai API nyata, AI Reformulation belum menjalankan model.

## AI Reformulation — frontend workflow

Product -> Clean Insight -> Baseline -> Engine Review -> Recommendations -> Evidence -> Lab Validation.
Input insight bisa diketik manual atau diambil dari detail Clear Insight pada Dataset Library.
R&D mengonfirmasi target, mengedit konsentrasi, menentukan fixed/adjustable dan batas.
Perubahan input mengunci ulang tahap berikutnya sampai validasi diulang.
Generate recommendations masih nonaktif: model/optimizer belum terhubung.
Candidate slots/evidence kosong, bukan hasil prediksi demo.
Tahap lab hanya mendownload rencana JSON berlabel draft; tidak menyimpan measured results.
Draft bersifat sementara dan hilang saat meninggalkan fitur/refresh.

## Verifikasi build

```powershell
npm run typecheck
npm run build
```

## Vercel (setelah proyek di-upload ke GitHub)

- Import repository proyek ini, bukan repository FormulaRescue lama.
- Framework: **Next.js**. Root Directory: **frontend**.
- Build Command: default `npm run build`; Output Directory: default.
- Formula Rescue memakai konektor same-origin Next.js, menuju API lama.
- Opsional server environment variable: FORMULARESCUE_API_URL.
- Default: https://formula-rescue-api-gold.vercel.app (backend lama yang sudah aktif).
- Tidak perlu NEXT_PUBLIC_API_BASE_URL untuk Formula Rescue ini.
- Deploy ini belum dilakukan oleh agent. Build sukses bukan bukti autentikasi aman.

Nama Spontan dan simbol S merupakan identitas sementara; warna mengikuti referensi
putih, biru laut, dan cyan.

## Formula Rescue — tahap integrasi

Alur: browser -> /api/formula-rescue/* pada Next.js -> FastAPI lama -> rescue engine
dan model XGBoost lama. Penghubung server menghindari ketergantungan CORS browser
ke API lama, bukan menambahkan autentikasi. Model tidak dipindahkan ke Next.js.

Untuk mencoba: masuk demo -> Formula Rescue -> Formula 7 -> Plantacare 818 -> Run.
Hasil sampel: Top 3 formula 288, 292, 190, diikuti peringkat 4–8.
Loading/error/empty-result tidak diganti hasil mock.
Process trace adalah ringkasan respons, bukan streaming per langkah.
Ranking score bukan probabilitas keberhasilan lab; sensory tidak diprediksi.

Default tidak memerlukan backend lokal, tunnel, atau .env.local. Backend Vercel
lama harus tetap tersedia. Jika ingin backend lokal, isi FORMULARESCUE_API_URL
dengan http://127.0.0.1:8000, restart Next.js, lalu jalankan dari folder Hackathon:

```powershell
cd D:\Spontan-Team\Hackathon
py -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Untuk frontend yang di-deploy ke Vercel, jangan set upstream ke localhost.
Sesi login demo dan hasil rescue hilang saat refresh/keluar halaman fitur.
Belum ada penyimpanan riwayat ke Dataset Library.

Konektor membatasi endpoint, pagination, input JSON 8 KiB, panjang ingredient,
top_k 1–10, dan timeout upstream 45 detik. Error internal tidak diteruskan.
Belum ada login sungguhan/rate limiter: hanya demo, jangan masukkan data rahasia.
