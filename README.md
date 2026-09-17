# Two-person AI Hackathon Starter

Workspace ini berawal dari template persiapan dan sekarang memiliki frontend demo,
Formula Rescue serta model sensory emulsi. Konfirmasi aturan panitia sebelum
membawa starter code; jangan menyatakan persiapan ini dibuat saat kompetisi.

## Checkpoint backend terbaru — 17 September 2026

FastAPI lokal sudah menyatukan Formula Rescue (XGBoost) dan AI Reformulation
(Polynomial + Ridge + bounded optimizer). Panduan dan fixture ada di
[backend/README.md](backend/README.md); hasil verifikasi dan batasannya di
[BACKEND_INTEGRATION_REPORT.md](BACKEND_INTEGRATION_REPORT.md).

Handoff repo baru, batas file yang diikutkan dan status deployment:
[docs/GITHUB_HANDOFF.md](docs/GITHUB_HANDOFF.md).

Konfigurasi satu project **Vercel Services** sekarang disiapkan untuk frontend
dan backend gabungan. Panduan dan batas verifikasinya:
[docs/VERCEL_SERVICES_SETUP.md](docs/VERCEL_SERVICES_SETUP.md).
Runtime Vercel belum diverifikasi; project Formula Rescue lama tidak diubah.
Frontend AI belum terhubung, dan penyimpanan/lab feedback bulanan masih rencana. Bagian di bawah
tetap panduan starter/team, bukan klaim semua integrasi sudah selesai.

## Mulai

1. Baca `docs/GITHUB_SETUP.md` untuk membuat repository terpisah dan mengundang teman.
2. Isi `PROJECT_SPEC.md` dan `docs/TEAM_CONTRACT.md` bersama.
3. Sepakati `docs/API_CONTRACT.md` dan `docs/MODEL_CONTRACT.md` sebelum coding paralel.

## Arsitektur target

```text
Cloudeka: training -> model + preprocessing + metadata + metrics
GitHub: handover artefak dan source code
Browser / Next.js -> FastAPI -> predictor -> artefak model
Vercel frontend + Vercel backend: setelah uji runtime dan batas paket
```

CPU inference adalah default deployment; GPU training tidak berarti inference membutuhkan GPU. Hosting alternatif ditentukan hanya jika deployment target tidak sesuai kebutuhan model atau aturan.

## Struktur dan fungsi

| Path | Isi |
|---|---|
| PROJECT_SPEC.md | Masalah, scope MVP, kriteria selesai |
| docs/TEAM_CONTRACT.md | Pembagian tugas, ownership, Git, jadwal |
| docs/API_CONTRACT.md | Bentuk request/response yang disepakati |
| docs/MODEL_CONTRACT.md | Kontrak model dari Cloudeka ke backend |
| docs/GITHUB_SETUP.md | Membuat repo baru, push, kolaborasi |
| docs/DEMO_CHECKLIST.md | Validasi demo, deployment, keamanan |
| AGENTS.md | Aturan bersama coding assistant |
| backend/AGENTS.md | Aturan khusus FastAPI |
| frontend/AGENTS.md | Aturan khusus Next.js |
| ml/AGENTS.md | Aturan khusus training di Cloudeka |
| data/README.md | Aturan dataset |
| ml/artifacts/README.md | Handover artefak |

Jangan menyalin dependency atau fitur FormulaRescue tanpa menyesuaikan case. Buat dependency runtime dan konfigurasi Vercel saat backend/model yang dipilih sudah jelas.

## Urutan pengembangan

Scope -> kontrak -> mock UI/API -> baseline Cloudeka -> handover -> integrasi lokal -> deployment -> hardening -> pitch.

Mock harus berlabel. Checkpoint minimum integrasi: satu input valid dan satu input salah diuji di lokal serta URL publik. Build sukses bukan bukti model sudah bekerja.

> Predicted / estimated and requires physical laboratory validation.

Disclaimer ini sesuai contoh produk berbasis eksperimen. Untuk case lain, sepakati disclaimer yang tepat tanpa menjanjikan akurasi atau keamanan yang belum diuji.
