# Spontan — frontend workspace

Form akses lokal, dashboard analisis, dan workflow R&D berada dalam satu aplikasi.
Formula Rescue dan AI Reformulation memakai unified backend yang sama.

## Dashboard dan Dataset Library

- Sidebar responsif bisa dibuka/ditutup; dashboard memiliki search, notes, dua
  pintasan analisis, Pinned Analysis, dan Latest Analysis.
- Library memiliki Clear Insight, Formula Rescue, AI Reformulation.
- Tiap kategori dapat diurutkan terbaru/terlama; waktu tampil dalam WIB.
- Pinned/Latest dan Library hanya menerima respons API yang sukses selama sesi
  browser aktif; tidak ada seeded history atau fallback hasil buatan.
- Klik judul untuk ringkasan, lalu buka Session Detail untuk request/response JSON.
- Download tersedia sebagai results CSV atau session JSON.
- Refresh/logout menghapus notes dan riwayat karena database belum tersedia.

## Jalankan di terminal VS Code / PowerShell

Terminal 1 (backend gabungan, dari root; setup dependency lihat backend/README.md):

```powershell
cd D:\Spontan-Team
py -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Terminal 2 (frontend; `npm ci` hanya perlu bila dependency belum tersedia):

```powershell
cd D:\Spontan-Team\frontend
$env:FORMULARESCUE_API_URL = "http://127.0.0.1:8001"
npm run dev
```

Buka http://localhost:3000 di browser. Isi username dan kode akses non-rahasia.
Password tidak dibaca oleh handler, disimpan, atau dikirim. Nama hanya berada
di state browser, hilang setelah refresh. Ini bukan autentikasi atau pembatas akses.

## Checkpoint manual

1. Input kosong tidak dapat masuk; username berisi spasi menampilkan error.
2. Masuk, buka/tutup sidebar, pindah menu, lalu Keluar.
3. Coba lebar layar HP; Formula Rescue dan AI Reformulation memakai API nyata.

## AI Reformulation — frontend workflow

Choose Product -> Insight / Reformulation Goal -> Formula & Limits -> AI Processing
-> Ranked Candidates -> Evidence -> Lab Validation.
Input insight bisa diketik manual atau diambil dari detail Clear Insight pada Dataset Library.
R&D mengonfirmasi target, mengedit konsentrasi, menentukan fixed/adjustable dan batas.
Perubahan input mengunci ulang tahap berikutnya sampai validasi diulang.
Prediksi baseline dan Generate recommendations memanggil API nyata. Input model
terbatas pada Phytantriol 0–3%, Soy lecithin 0–3%, dan CCT 0–5%. Insight/catatan
teks serta parameter proses hanya konteks; tidak diterjemahkan atau dioptimasi.
Hasil menampilkan Top 3 atau empty search yang jujur, proses pencarian, perubahan
komposisi/respons, evidence dan raw session JSON. Tidak ada confidence probability.
Tahap lab mendownload rencana yang terikat ke candidate ID, tetapi tidak menyimpan
measured results atau meningkatkan model otomatis.
Draft bersifat sementara dan hilang saat meninggalkan fitur/refresh.

## Verifikasi build

```powershell
npm run typecheck
npm run build
```

## Vercel (setelah proyek di-upload ke GitHub)

- Import repository proyek ini, bukan repository FormulaRescue lama.
- Preset: **Services**. Project Root Directory: **./**; konfigurasi root menentukan
  frontend Next.js/root `frontend` dan backend FastAPI/root `.`.
- Build/Output: default; lihat docs/VERCEL_SERVICES_SETUP.md untuk langkah lengkap.
- Vercel Services memakai konektor same-origin Next.js menuju backend gabungan
  melalui binding runtime `SPONTAN_BACKEND_URL`; jangan isi binding secara manual.
- `FORMULARESCUE_API_URL` hanya override lokal/legacy. AI gagal 503 bila tidak
  ada binding atau override eksplisit, sehingga tidak diam-diam memakai API lama.
- Tidak perlu `NEXT_PUBLIC_API_BASE_URL`; URL backend tetap server-side.
- Deploy ini belum dilakukan oleh agent. Build sukses bukan bukti autentikasi aman.

Nama Spontan dan simbol S merupakan identitas sementara; warna mengikuti referensi
putih, biru laut, dan cyan.

## Formula Rescue — tahap integrasi

Alur: browser -> /api/formula-rescue/* pada Next.js -> unified FastAPI -> rescue
engine dan model XGBoost existing. Penghubung server menghindari ketergantungan
CORS browser, bukan menambahkan autentikasi. Model tidak dipindahkan ke Next.js.

Untuk mencoba: masuk -> Formula Rescue -> Formula 7 -> Plantacare 818 -> Run.
Hasil sampel: Top 3 formula 288, 292, 190, diikuti peringkat 4–8.
Loading/error/empty-result tidak diganti hasil mock.
Process trace adalah ringkasan respons, bukan streaming per langkah.
Ranking score bukan probabilitas keberhasilan lab; sensory tidak diprediksi.

Deployment Services tidak memerlukan backend lokal, tunnel, atau `.env.local`.
Pengembangan lokal harus menjalankan unified backend dan environment variable
seperti petunjuk **Jalankan di terminal** di atas; API Rescue-only lama tidak
mendukung endpoint AI Reformulation.

Untuk frontend yang di-deploy ke Vercel, jangan set upstream ke localhost.
Sesi akses dan hasil analisis hilang saat refresh/logout. Hasil API tersedia pada
dashboard/library selama sesi browser. Feedback validasi lab dapat diunduh sebagai
JSON, tetapi belum dikirim ke backend atau dipakai retraining.

Konektor membatasi endpoint, pagination, input JSON 8 KiB, panjang ingredient,
top_k 1–10, dan timeout upstream 45 detik. Error internal tidak diteruskan.
Belum ada login sungguhan/rate limiter; jangan masukkan kredensial atau data rahasia.
