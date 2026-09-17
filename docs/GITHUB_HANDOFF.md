# Spontan-Team — source handoff

Repository tujuan: https://github.com/araafritaa/spontan-team.git
Workspace lokal: `D:\Spontan-Team`.

## Apa yang disertakan

- Frontend dashboard/demo, Formula Rescue connector, dataset library dan AI wizard.
- Unified backend `backend.main:app`: Formula Rescue + sensory prediction/optimizer.
- Trusted Polynomial + Ridge artifact serta preprocessing/evaluation metadata.
- Sembilan file serving Formula Rescue existing di `Hackathon/`: package init,
  engine, response schemas, katalog/ingredient metadata dan XGBoost/metadata/metrics.
  File ini disertakan sebagai file biasa, **bukan submodule/gitlink**. Git lama
  di `Hackathon/.git` tetap lokal dan tidak diubah atau dikirim.
- Workbook input, ZIP engine lama, poster, node_modules, builds, caches dan
  konfigurasi `.env` asli tidak disertakan. Dataset workbook perlu transfer
  terpisah bila teman ingin menjalankan preprocessing dari sumber asli.

## GitHub bukan deployment

Push menyimpan source ke GitHub; tidak otomatis menggabungkan atau mengubah
project Vercel Formula Rescue lama yang memakai repo `formula-rescue`.
Backend gabungan saat checkpoint ini berjalan lokal. Konfigurasi root sekarang
menargetkan **satu project Vercel Services**, bukan dua project: frontend Next.js
di `frontend`, backend FastAPI di root dengan binding internal. Panduan:
[VERCEL_SERVICES_SETUP.md](VERCEL_SERVICES_SETUP.md).
Frontend memakai binding runtime lebih dulu; jika binding/config tidak ada di
Vercel, proxy gagal dengan 503, bukan diam-diam memakai API lama. Fallback lama
hanya berlaku di pengembangan non-Vercel. AI wizard belum dihubungkan ke API baru.
Schema, globs, pin dependency, tes lokal dan build frontend sudah diperiksa;
clean install Linux, bundle akhir dan koneksi runtime Vercel masih pending.

`Hackathon/vercel.json` dan `Hackathon/pyproject.toml` lama bukan konfigurasi
backend gabungan baru dan tidak disertakan pada paket serving minimal ini.
Jangan memilih Root Directory `Hackathon` untuk backend gabungan.
Sesudah Services online, uji readiness lewat frontend dan hubungkan wizard AI
pada tahap berikutnya. Deployment lama tetap terpisah sampai keputusan migrasi.

## Teman mengambil project

Undang akun teman melalui repository Settings → Collaborators; jangan berbagi
password/token. Setelah menerima undangan, di terminal laptop teman:

```powershell
git clone https://github.com/araafritaa/spontan-team.git
cd spontan-team
git switch -c feat/frontend
```

Backend setup/test: `backend/README.md`; frontend setup: `frontend/README.md`.
Gunakan akun masing-masing dan review lewat pull request, bukan force-push.
Tidak ada dependency/environment pribadi yang ikut dikirim.

> Predicted / estimated and requires physical laboratory validation.
