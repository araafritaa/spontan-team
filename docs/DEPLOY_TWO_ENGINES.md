# Localhost dan deploy kedua engine

Checkpoint 18 September 2026. Kedua engine lolos inferensi HTTP lokal:
Formula Rescue XGBoost (Top 3: 288, 292, 190) dan model produk sintetis
Polynomial + Ridge (22 produk / 11 kategori).
Model AI baru memakai data sintetis, bukan formula asli atau hasil lab Paragon.
Schema Services Vercel resmi: nol error; includeFiles/excludeFiles 242/166 karakter.
Belum ada bukti runtime deployment publik terbaru.

## A. Perbaikan localhost

Pesan backend belum dikonfigurasi muncul sebelum request upstream jika Route
Handler Next.js tidak memperoleh SPONTAN_BACKEND_URL / override legacy.
File frontend/.env.local sebelumnya tidak ada; sekarang dibuat:
SPONTAN_BACKEND_URL=http://127.0.0.1:8001.
Ini setting lokal server-side, bukan secret dan bukan NEXT_PUBLIC_.
Jangan upload file env lokal ke Git/Vercel.

Terminal pertama:

```powershell
cd D:\Spontan-Team
py -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Terminal kedua:

```powershell
cd D:\Spontan-Team\frontend
npm run dev
```

Jika frontend sudah berjalan, hentikan milikmu dengan Ctrl+C dan jalankan lagi
agar setting env terbaca. Jangan matikan proses lain secara sembarangan.
Buka localhost:3000/api/formula-rescue/ready; kedua engine harus ready.
Buka localhost:3000/api/ai-reformulation/products; harus ada 22 profil.
Jika Next.js memilih port selain 3000, gunakan port yang tertulis di terminalnya.

## B. Kirim source terbaru

Repo tujuan: araafritaa/spontan-team, bukan repo Formula Rescue lama.
Perubahan terbaru masih lokal sampai di-commit/push.
Di Source Control VS Code, review dan stage file aplikasi/config/docs serta
artifact model produk baru (joblib, model_metadata.json,
prediction_example.json, product_catalog.json).
Jangan stage secrets, .env.local, node_modules, .next, atau data private.
Commit dengan pesan yang jelas, lalu push branch yang dipakai Vercel.
Periksa hash commit dengan git log -1 --oneline.
Redeploy commit lama tidak membawa perubahan source yang belum dipush.

## C. Import di Vercel

1. Add New -> Project -> import araafritaa/spontan-team.
   Jika project sudah terhubung repo ini, gunakan konfigurasi project itu;
   tidak perlu menghapus project Formula Rescue lama.
2. Application Preset Services. Root Directory ./ (root repo).
   Frontend: framework Next.js, root frontend.
   Backend: framework FastAPI, root ., entrypoint backend.main:app.
   Build/Install/Output tetap default (hapus override lama yang khusus frontend).
   Refresh jika daftar Services belum membaca vercel.json terbaru.
3. Environment Variables: tidak perlu URL backend manual.
   Jangan isi localhost, URL tunnel, atau backend Formula Rescue lama.
   Binding pada vercel.json menyuntikkan SPONTAN_BACKEND_URL ke fungsi frontend
   saat runtime. NEXT_PUBLIC_API_BASE_URL tidak dipakai aplikasi ini.
   Klik Deploy dan cocokkan Source commit dengan commit terbaru GitHub.

Dokumentasi resmi: https://vercel.com/docs/services/bindings.
Binding hanya tersedia saat runtime server functions, bukan build/browser.
Kedua service dan engine ikut deployment yang sama; laptop/tunnel tidak dibutuhkan
setelah cloud runtime benar-benar lolos.

## D. Uji setelah Ready

- https://<domain-project>/api/formula-rescue/ready:
  status ready, engines.formula_rescue.status=ready,
  engines.ai_reformulation.status=ready.
- https://<domain-project>/api/ai-reformulation/products: katalog 22 produk.
- Jalankan Formula 7 + Plantacare 818, lalu proses dua produk AI berbeda.
- Kirim URL deployment dan build/runtime log jika gagal. Ready build saja
  bukan bukti kedua model berhasil dimuat saat runtime.

Backend tidak diberi route publik langsung; /ready, /docs atau /formulas pada
domain frontend bukan endpoint FastAPI publik. Pakai proxy /api/... di atas.
Binding bukan authentication pengguna; login aplikasi belum auth backend nyata.
Jangan masukkan formula atau data internal perusahaan.
Belum ada persistence lab/session, rate limiting terdistribusi atau scheduler.

Predicted / estimated and requires physical laboratory validation.
