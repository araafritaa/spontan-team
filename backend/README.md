# Backend gabungan Spontan

Satu FastAPI melayani dua engine yang **berbeda**:

```text
Frontend → API gabungan
              ├─ Formula Rescue → katalog shampoo + XGBoost → kandidat historis
              └─ AI Reformulation → Polynomial + Ridge + optimizer → kandidat emulsi
```

API adalah pintu komunikasi: frontend mengirim input, backend memeriksa input,
memanggil model yang sudah dilatih, lalu mengembalikan hasil. API tidak melatih
model ketika pengguna menekan Run.

## Jalankan lokal

Di terminal PowerShell VS Code, **dari root project**, bukan folder backend:

```powershell
cd D:\Spontan-Team
py -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Expected: `Uvicorn running on http://127.0.0.1:8001`.
Port 8001 dipilih untuk mengurangi bentrok dengan backend lama di 8000.
Jika 8001 sudah dipakai, hentikan proses yang kamu jalankan sebelumnya atau
pilih port kosong. Jangan mematikan proses lain secara sembarangan.

Buka **browser**: http://127.0.0.1:8001/docs. Swagger adalah halaman untuk
mencoba API tanpa membuat frontend tambahan. Tekan **Try it out**, isi JSON,
lalu **Execute**. Hentikan server dengan Ctrl+C di terminalnya.

Mulai dari `/ready`: expected HTTP 200 dan kedua engine berstatus `ready`.
`/health` hanya memeriksa server hidup, bukan model siap.

## Coba Formula Rescue

`POST /reformulate`:

```json
{
  "formula_id":7,
  "constraint":{"type":"ingredient_unavailable","ingredient":"Plantacare 818"},
  "top_k":3
}
```

Expected Top 3: **288, 292, 190**. `/formulas` berisi 294 formula historis stabil,
bukan formula emulsi AI Reformulation. Aturan/ranking lama tidak diganti.

## Coba AI Reformulation

`POST /ai-reformulation/predict`:

```json
{"composition":{"phytantriol_pct":1.5,"soy_lecithin_pct":2.5,"cct_pct":3.0}}
```

Expected perkiraan: hydration 1.56236, stickiness 3.21667, oiliness 2.65741,
consistency 28816.46665. Ini empat nilai regresi, bukan persentase accuracy.

`POST /ai-reformulation/optimize`:

```json
{
  "baseline":{"phytantriol_pct":1.5,"soy_lecithin_pct":2.5,"cct_pct":3.0},
  "target_constraints":{"hydration_ratio_min":1.55,"stickiness_score_0_10_max":3.5},
  "fixed":[],
  "top_k":3,
  "seed":42
}
```

Expected HTTP 200, `CANDIDATES_FOUND`, tiga kandidat. `process` menunjukkan
10.000 titik diuji dan 1.297 alternatif lolos pada fixture/runtime ini.
Kandidat diurutkan berdasarkan perubahan komposisi paling kecil, lalu disaring
agar tidak terlalu mirip satu sama lain. Seed tetap membuat pencarian dapat diulang
di runtime/versi yang sama. Default jarak keragaman 0.03 pada ruang ternormalisasi.

Opsional: `"fixed":["cct_pct"]` mengunci CCT. `bounds` membatasi faktor tertentu:
`"bounds":{"soy_lecithin_pct":{"min":2.0,"max":3.0}}`.
Baseline harus berada di dalam bounds; bounds tidak boleh keluar dari rentang studi.
Ini hanya optimasi tiga faktor, **bukan formula komersial lengkap**.

Ganti target hydration menjadi 1.6: expected hasil kosong yang jujur. Tidak ada
fallback kandidat yang gagal target. Semua bahan dikunci juga berarti tidak ada
alternatif, bukan mengembalikan baseline sebagai kandidat baru.

## Model, dependencies dan batas tahap ini

- Saved-model loading di-cache; request tidak membuat/training model baru.
- Perubahan artifact memerlukan restart/release backend; belum ada hot reload
  atau mekanisme penggantian model atomik. Cache berlaku untuk instance proses.
- Runtime yang diuji: Python 3.12.7 dan paket di `requirements.txt`.
- Belum diuji dalam venv baru; pin direct dependency bukan lock transitive.
  Untuk environment baru: buat venv lalu install `backend/requirements-dev.txt`
  dan jalankan tes di bawah sebelum menganggapnya kompatibel.
- File `.env.example` adalah contoh; aplikasi ini **tidak otomatis membaca .env**.
  CORS dibaca dari environment proses `CORS_ORIGINS`, dipisah koma, origin exact.
- Lokal default mengizinkan browser localhost:3000 / 127.0.0.1:3000.
- Tidak ada login backend, database, penyimpanan eksperimen atau scheduler bulanan.
- Body dibatasi 16 KiB; optimizer dibatasi 10.000 titik dan dua request simultan
  per proses. Ini bukan perlindungan rate-limit internet lengkap.
- Jangan langsung expose backend ini ke publik tanpa review deployment/akses/data.
- Vercel/bundle Linux belum diverifikasi; paket XGBoost Linux dapat membawa
  dependency GPU tambahan. Review ukuran dan CPU runtime sebelum deployment.
- Artefak/data dibaca saja; modul lama `spontan_engine/forward_model.py` tidak dipakai.

## Tes

Dari root project:

```powershell
py -m unittest discover -s backend/tests -v
py backend/tests/http_smoke.py
```

Expected: unit/API tests `OK`, smoke test `PASS`. Smoke test menyalakan child server
hanya di loopback, menguji enam endpoint lewat HTTP sungguhan, lalu menghentikannya.
Tidak membuat tunnel, public endpoint atau deployment.

## Frontend belum diubah

Formula Rescue frontend existing masih default menuju backend publik lama.
Nanti server-side `FORMULARESCUE_API_URL` dapat diarahkan ke
`http://127.0.0.1:8001` saat Next.js juga berjalan di laptop yang sama.
AI Reformulation wizard belum dihubungkan. Jangan gunakan URL localhost ini
sebagai backend frontend Vercel: localhost di cloud bukan laptopmu.

Kontrak lengkap: `docs/API_CONTRACT.md`, `docs/MODEL_CONTRACT.md`.

> Predicted / estimated and requires physical laboratory validation.
