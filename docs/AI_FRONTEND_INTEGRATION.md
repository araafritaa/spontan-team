# AI Reformulation frontend integration

Checkpoint 17 September 2026. Implementasi lokal, belum push/deploy pada tahap ini.
Model dan optimizer backend existing dipakai tanpa retraining atau perubahan kontrak.

## Alur yang bekerja

Choose Product → Insight / Reformulation Goal → Formula & Limits → AI Processing
→ Ranked Candidates → Evidence → Lab Validation.

- Target numerik dipilih manual: minimum/maximum hydration ratio atau stickiness
  0–10. Hydration dapat diberi maksimum stickiness sebagai trade-off. Ini ambang
  absolut, bukan persentase atau jaminan improvement terhadap baseline.
- Tiga faktor: Phytantriol 0–3%, Soy lecithin 0–3%, CCT 0–5%. Fixed/bounds
  diteruskan ke optimizer; insight, preserve note dan parameter proses hanya konteks.
- Prediksi baseline → `/api/ai-reformulation/predict` → FastAPI predictor.
- Generate → `/api/ai-reformulation/optimize` → FastAPI optimizer. Browser memakai
  URL same-origin; backend dipilih server-side melalui binding Services.
- Hasil: sampai tiga kandidat, komposisi/respons baseline vs candidate, delta,
  target checks, jumlah sampled/valid/feasible/returned, seed, ranking dan provenance.
- Evidence menampilkan versi model, studi/rentang, limitations serta request/response
  JSON presisi asli. Per-target pass count independen, bukan tahap funnel berurutan.
- Lab plan JSON terikat ke candidate ID terpilih dan model version; measured results
  tetap null. Ini rencana uji, bukan physical validation yang telah selesai.

Tidak ada fallback mock. Loading mengunci submit/navigation wizard; request dibatalkan
saat fitur ditinggalkan. Perubahan input membuang hasil dan mengunci tahap berikutnya.
Empty search tetap HTTP 200/hasil kosong, bukan bukti global infeasibility.
Proxy hanya dua endpoint, JSON object/16 KiB, timeout 45 detik, no-store, tanpa
cookie/token browser, tanpa arbitrary target URL; error internal disanitasi.

## Bukti verifikasi lokal

| Pemeriksaan | Hasil |
|---|---|
| Frontend contract/proxy tests | 17/17 PASS |
| Typecheck + production build | PASS; kedua route proxy tercakup |
| Backend regression | 20/20 PASS |
| Backend actual HTTP smoke | 6 endpoint PASS; Rescue Top 3 tetap 288, 292, 190 |
| Next production → bound FastAPI | Predict, Top 3, empty, invalid 422 PASS |
| Real headless Chromium UI | 14 checks PASS; memakai respons model nyata |

Browser checks: local access form, dashboard, Rescue Top 3, download feedback lab,
baseline prediction, AI Top 3, lebar 390 px tanpa page overflow, evidence,
candidate-bound lab plan, range salah, hasil lama invalidated, network error/retry,
pencarian kosong, dan riwayat sesi. Bukan audit aksesibilitas/visual seluruh aplikasi.

Fixture: baseline 1.5/2.5/3.0%, hydration minimum 1.55, stickiness maksimum 3.5.
Predict hydration: 1.5623600002295417. Search: 10,000 sampled, 1,297 feasible,
3 returned. Candidate IDs: `emulsion-c23f77c1e62189fc`, `emulsion-a0b73d23fee941ca`,
`emulsion-ed68654cc3ad71f9`. ID deterministik bukan experiment ID tersimpan.

## Menjalankan ulang tes

Setelah dependency tersedia, dari frontend:

```powershell
node --test tests/ai-reformulation.test.mjs tests/server-backend.test.mjs
npm run typecheck
npm run build
```

Dari root repo, setelah build frontend:

```powershell
py -m unittest discover -s backend/tests -v
py backend/tests/http_smoke.py
py frontend/tests/live-ai-integration.py
py frontend/tests/live-ai-integration.py --browser
```

Browser test optional memakai Edge Windows yang sudah tersedia, atau executable
Chrome/Edge dari `AI_TEST_BROWSER`. Tidak perlu paket automation tambahan; Node 24
dipakai saat verifikasi. Server dan debugger hanya loopback, proses uji dihentikan;
profil sementara berada di `tmp/` yang di-ignore. Download file fisik dinonaktifkan
pada tes; isi Blob lab plan diperiksa langsung.

## Batas dan langkah berikutnya

Training data berasal dari persamaan publikasi, bukan data physical validation baru.
Model tidak memprediksi safety/stability/cost/sustainability/proses. Consistency
unit fisiknya belum terverifikasi. Tampilan angka dibulatkan; resep yang dibulatkan
perlu prediksi/target check ulang. Tidak ada confidence atau accuracy lab yang diklaim.

Form masuk bukan autentikasi. Dashboard/Library menyimpan hasil API hanya di state
browser dan tidak memiliki seeded history. Feedback lab Rescue dapat diunduh sebagai
JSON, tetapi tidak diunggah. Tidak ada persistence, scheduler bulanan, retraining
otomatis atau rate limiting terdistribusi.
Runtime Linux CPU/bundle/cold start/binding Vercel belum diverifikasi. Push perubahan
ini dan gunakan deployment terbaru untuk uji online; deployment lama tidak diubah.

> Predicted / estimated and requires physical laboratory validation.
