# Spontan: deployment Vercel Services

Panduan terbaru kedua engine dan perbaikan env localhost:
[DEPLOY_TWO_ENGINES.md](DEPLOY_TWO_ENGINES.md). Ikuti fixture produk sintetis
terbaru; angka hasil pemeriksaan di bawah adalah checkpoint 17 September.

Checkpoint 17 September 2026: konfigurasi disiapkan dan diuji lokal, **belum
dibuktikan berjalan di Vercel**. Ini menggantikan rencana dua project pada
handoff sebelumnya; project Formula Rescue lama tidak diubah.

## Alur koneksi

```text
Browser -> Next.js frontend (URL publik)
                -> Route Handler /api/formula-rescue/*
                -> SPONTAN_BACKEND_URL (binding internal saat runtime)
                -> FastAPI -> Formula Rescue / sensory predictor + optimizer
```

`vercel.json` root mendefinisikan frontend di `frontend`, backend di root repo
dan entrypoint `backend.main:app`. Hanya frontend mendapat rewrite publik.
Backend tidak diberi route publik; binding menghubungkan kedua service dalam
deployment yang sama. Binding tersedia saat runtime, bukan saat build.
Lihat [dokumentasi binding Vercel](https://vercel.com/docs/services/bindings).

AI predictor/optimizer dan wizard frontend sudah terhubung melalui Route Handler
same-origin. Deployment ini belum membuktikan runtime publik berhasil.
Riwayat library masih demo; database, auth nyata dan retraining bulanan belum ada.

## Tiga tindakan di dashboard Vercel

1. Sesudah commit konfigurasi berhasil dipush, refresh halaman import repo
   `araafritaa/spontan-team` (atau tombol Refresh pada daftar Services).
2. Pilih Application Preset **Services**, Root Directory **./** dan nama
   project `spontan-team`. Biarkan Build/Output memakai default. Pastikan
   frontend memakai Next.js/root `frontend` dan backend FastAPI/root `.`.
3. Kosongkan Environment Variables manual pada project baru, lalu **Deploy**.
   Kirim build log jika gagal; jangan menghapus konfigurasi untuk menebak-nebak.

Tidak perlu mengisi `NEXT_PUBLIC_API_BASE_URL`, `SPONTAN_BACKEND_URL` atau URL
backend lama. Vercel mengisi binding `SPONTAN_BACKEND_URL` untuk frontend.
Tidak perlu tunnel atau laptop menyala setelah deployment ini benar-benar lolos
uji runtime. Untuk pengembangan lokal, `.env.example` tetap menunjuk API lokal.

Jika sudah ada project Spontan, pilih deployment dari commit terbaru; redeploy
commit lama tidak mengambil perubahan source terbaru. Repo/project Formula
Rescue lama bukan tujuan konfigurasi ini.

## Pemeriksaan setelah status Ready

- Buka `https://<domain-project>/api/formula-rescue/health`: status `ok` hanya
  membuktikan HTTP server hidup.
- Buka `https://<domain-project>/api/formula-rescue/ready`: status `ready`
  membuktikan kedua artefak model berhasil dimuat dan menjalankan inferensi.
  Endpoint ini melewati frontend proxy, sehingga sekaligus menguji binding.
- Di dashboard jalankan Formula 7, bahan unavailable `Plantacare 818`, Top 3.
  Fixture yang diharapkan: Formula 288, 292, 190. Uji juga lewat perangkat lain.

Root `/docs` atau `/formulas` bukan route FastAPI publik pada konfigurasi ini.
Swagger tetap tersedia saat backend dijalankan lokal. URL publik aplikasi
adalah domain frontend project baru, bukan URL tunnel atau project API lama.

## Perbaikan dan bukti verifikasi

- `pyproject.toml` memiliki `[project]` serta entrypoint FastAPI; Python dipin 3.12.
- Dependency langsung dan transitif serving dipin sama di pyproject/requirements.
  Ini penguncian versi, **bukan hash lock/uv.lock**. Test-only httpx terpisah.
- Linux x86_64 memilih `xgboost-cpu==3.4.1`, bukan XGBoost GPU/NCCL.
  Wheel CPU tersedia (5.53 MB terkompresi); ukuran itu bukan total bundle.
  [Pilihan paket resmi XGBoost](https://xgboost.readthedocs.io/en/stable/install.html).
- `includeFiles`/`excludeFiles` berbentuk string dengan panjang 212/166 karakter,
  di bawah batas 256 pada schema resmi. Dua belas file runtime wajib ada,
  cocok include dan tidak terkena exclude. Workbook, frontend, node_modules,
  caches, temp dan CSV hasil training bukan payload backend.
- Instance konfigurasi lolos schema resmi yang diambil saat pemeriksaan.
  Pemeriksaan memakai instance validator langsung: metaschema draft lama dari
  provider sendiri tidak menerima beberapa boolean schema Services terbaru.
- Frontend: tujuh tes helper/proxy lolos, typecheck dan build produksi lolos.
- `npm audit --omit=dev`: nol advisory pada dependency frontend production
  saat pemeriksaan. Paket development tidak termasuk hasil audit ini.
- Backend: 20 tes dan enam endpoint HTTP nyata lolos. Fixture kedua model serta
  optimizer tetap cocok setelah Starlette/idna diperbarui.
- Seluruh dependency transitif aktif runtime Windows terpin dan memenuhi rentang
  kompatibilitas metadata; metadata paket CPU Linux tidak memerlukan NCCL.

### Keamanan dependency dan batas bukti

Audit OSV menemukan advisory pada Starlette 1.0.0/idna 3.13 di Python global
laptop. Pin deployment diperbaiki ke **Starlette 1.6.0/idna 3.20**. Keduanya
dipasang dalam folder uji terisolasi dan diverifikasi benar-benar terimpor;
Python global tidak diubah. Seluruh 25 entri dependency serving yang dipin
(termasuk alternatif platform) tidak mengembalikan advisory pada query OSV
17 September 2026. Ini snapshot database advisory, bukan jaminan keamanan.
Contoh temuan: [Starlette](https://osv.dev/vulnerability/GHSA-82w8-qh3p-5jfq),
[idna](https://osv.dev/vulnerability/GHSA-65pc-fj4g-8rjx).

Uji ini memakai dependency ML yang sudah terpasang dan dua patch terisolasi.
Instalasi venv penuh dari nol dihentikan karena unduhan wheel lambat; **tidak
diklaim lolos fresh-install**. Clean install Linux/CPU, ukuran bundle akhir,
cold start dan binding nyata masih harus dibuktikan oleh build serta runtime
Vercel. Gunakan deployment pertama sebagai checkpoint pengujian, bukan
langsung membagikan aplikasi sebagai production-ready.

Backend internal tidak berarti autentikasi pengguna. Demo login bukan auth
nyata; proxy tetap dapat diakses publik. Binding bukan otorisasi aplikasi.
Belum ada rate limiting terdistribusi, penyimpanan feedback atau scheduler.
Jangan masukkan data rahasia; tinjau biaya/limit dan deployment protection sebelum
berbagi luas. Model hanya inferensi, tidak dilatih ulang dalam request.

> Predicted / estimated and requires physical laboratory validation.
