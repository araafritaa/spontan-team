# Backend gabungan Spontan

Satu FastAPI melayani dua engine yang **berbeda**:

```text
Frontend → API gabungan
              ├─ Formula Rescue → katalog shampoo + XGBoost → kandidat historis
              └─ AI Reformulation → Polynomial + Ridge + optimizer → kandidat profil produk sintetis
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

Mulai dengan `GET /ai-reformulation/products`: katalog 22 profil / 11 kategori.
Category, label tiga faktor, range dan baseline berasal dari katalog ini.
Nama produk adalah identitas; seluruh profil/komposisi/target training sintetis,
bukan formula asli Paragon atau pengukuran lab.

`POST /ai-reformulation/predict`:

```json
{"product_id":"wardah-lightening-day-cream","composition":{"factor_a_pct":4.0,"factor_b_pct":8.0,"factor_c_pct":2.2}}
```

Fixture model saat ini: hydration ~1.209925, stickiness ~3.348777,
oiliness ~3.082251, consistency ~19225.76 (indeks sintetis, bukan viscosity cP).

`POST /ai-reformulation/optimize`:

```json
{
  "product_id":"wardah-lightening-day-cream",
  "baseline":{"factor_a_pct":4.0,"factor_b_pct":8.0,"factor_c_pct":2.2},
  "target_constraints":{"hydration_ratio_min":1.25,"stickiness_score_0_10_max":4.5},
  "fixed":[],
  "top_k":3,
  "seed":42
}
```

Expected HTTP 200, CANDIDATES_FOUND, tiga kandidat pada fixture ini.
Search 10.000 titik dalam range profil terpilih; ranking perubahan ternormalisasi
terkecil lalu diversity 0.03. Product ID mempengaruhi prediksi model.
Ganti product_id dan gunakan baseline/range produk dari katalog, bukan recipe lama.

Opsional fixed factor_c_pct atau bounds faktor tertentu. Kadar dan bounds harus
dalam range profil produk; unknown product ditolak 422. Hydration target 100
menghasilkan empty search yang jujur. Semua bahan fixed juga menghasilkan nol
alternatif, bukan baseline sebagai kandidat baru.

Model Mercurio lama tetap tersimpan, tetapi kontrak/current API telah berubah.
Laporan lengkap: docs/PRODUCT_MODEL_INTEGRATION.md.

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
hanya di loopback, menguji tujuh endpoint lewat HTTP sungguhan, lalu menghentikannya.
Tidak membuat tunnel, public endpoint atau deployment.

## Frontend sudah tersambung

Kedua fitur memakai same-origin Next.js Route Handler. Server-side
SPONTAN_BACKEND_URL menunjuk backend gabungan. Lokal:
`$env:SPONTAN_BACKEND_URL = 'http://127.0.0.1:8001'` sebelum `npm run dev`
di frontend. Services Vercel memasukkan binding runtime secara otomatis.
Jangan isi URL localhost sebagai backend publik: localhost cloud bukan laptopmu.

Choose Brand -> Choose Product -> Category otomatis. Formula version dihapus.
Hasil real API tersimpan di memori sesi browser saja, bukan database.
Kontrak AI baru memerlukan rilis frontend dan backend bersama.

Kontrak lengkap: `docs/API_CONTRACT.md`, `docs/MODEL_CONTRACT.md`.

> Predicted / estimated and requires physical laboratory validation.
