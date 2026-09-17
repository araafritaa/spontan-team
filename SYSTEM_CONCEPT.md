# Spontan — Whole System Concept
## Satu workspace R&D untuk Formula Rescue dan AI Reformulation

Tanggal: 17 September 2026.
Nama Spontan adalah identitas kerja sementara.

### Pembaruan checkpoint backend — 17 September 2026

Backend lokal `backend.main:app` kini melayani **dua engine**: Formula Rescue
existing di `Hackathon/` dan AI Reformulation Polynomial + Ridge dengan bounded
optimizer. Keenam endpoint, strict input, readiness dua model, versi artifact,
error handling dan HTTP lokal sudah diuji. Lihat
[BACKEND_INTEGRATION_REPORT.md](BACKEND_INTEGRATION_REPORT.md) untuk evidence
dan [backend/README.md](backend/README.md) untuk menjalankan.

Frontend Formula Rescue masih default menuju API publik lama; wizard AI belum
diarahkan ke backend baru. Tidak ada deploy, lab storage atau scheduler bulanan.
Bagian arsitektur/status di bawah adalah snapshot konsep sebelumnya: penyebutan
API/optimizer AI sebagai planned kini digantikan pembaruan **lokal** ini,
bukan berarti seluruh arsitektur target atau frontend sudah terintegrasi.

Dokumen ini merangkum arah produk, hubungan antarbagian, kondisi implementasi,
dan rencana berikutnya. Bukan klaim bahwa semua fitur sudah selesai.
Aturan event dan keputusan yang masih TBD dalam [PROJECT_SPEC.md](PROJECT_SPEC.md)
tetap harus dikonfirmasi; dokumen ini tidak menganggapnya sudah disepakati.

## 1. Ide utama

Kita membangun satu aplikasi untuk tim R&D/formulator kosmetik yang membantu
menentukan **eksperimen apa yang sebaiknya diuji berikutnya**, melalui dua fitur:

- **Formula Rescue:** formula yang sudah berhasil menghadapi bahan tidak tersedia.
  Sistem mencari formula historis alternatif yang memenuhi batas tersebut.
- **AI Reformulation:** produk/formula yang sudah ada mendapatkan insight konsumen.
  Sistem mencari perubahan konsentrasi atau proses dalam batas evidence yang sesuai.

Keduanya memberi dukungan keputusan, bukan formula final yang dijamin berhasil.
Manusia menetapkan kebutuhan dan batas; model memperkirakan respons; lab memvalidasi.

> Predicted / estimated and requires physical laboratory validation.

## 2. Pengguna dan masalah

Pengguna utama: tim cosmetic R&D/formulation scientist.
Marketing berada di hulu: menyerahkan insight konsumen yang sudah dibersihkan.

| Masalah | Fitur | Keputusan yang dibantu |
|---|---|---|
| Bahan formula shampoo tidak tersedia | Formula Rescue | Kandidat historis mana yang layak diuji sebagai alternatif? |
| Konsumen merasa produk kurang melembapkan/lengket | AI Reformulation | Konsentrasi/proses mana yang layak diubah untuk eksperimen? |
| Insight dan hasil eksperimen sulit ditelusuri | Dataset Library, direncanakan tersambung | Apa input, hasil, evidence, dan validasi dari sesi sebelumnya? |

Tidak semua complaint dapat dijawab model. Target yang belum didukung harus
ditampilkan sebagai **not evaluated**, bukan dibuatkan prediksi.

## 3. Satu aplikasi, beberapa modul

```text
Login demo
   ↓
Dashboard utama
   ├── Formula Rescue
   │      └── Formula + ingredient unavailable → Top 3 historical candidates
   ├── AI Reformulation [dalam pengembangan]
   │      └── Clean insight + baseline + constraints → Top 3 experiment candidates
   └── Dataset Library [UI demo]
          ├── Clear Insight
          ├── Formula Rescue history
          └── AI Reformulation history
```

Semua halaman berada dalam frontend yang sama, dengan sidebar yang bisa ditutup.
Tema bersama: putih, biru laut, cyan; form dan tabel terbaca di laptop maupun HP.
Pengguna tidak perlu berpindah ke website Formula Rescue lama.

**Satu aplikasi bagi pengguna tidak berarti satu model atau satu deployment.**
Model rescue shampoo berbeda dari model sensory/reformulation.

Login saat ini menerima username/password dummy. Password tidak dibaca handler,
disimpan, atau dikirim. Username hanya berada dalam state browser.
Ini simulasi navigasi, **bukan autentikasi**, bukan perlindungan akses aplikasi/API.

## 4. Formula Rescue — alur yang sudah terintegrasi

### Input

- Formula awal dari daftar formula historis experimentally observed stable.
- Satu ingredient unavailable yang ada di formula tersebut.
- UI meminta delapan hasil agar Top 3 dan kandidat berikutnya bisa terlihat.

### Proses di backend lama

```text
Original shampoo formula + unavailable ingredient
   ↓
Validasi formula dan bahan
   ↓
Cari kandidat historis:
berbeda dari original + observed stable + ingredient unavailable = 0%
   ↓
XGBoost memperkirakan phase stability
   ↓
Hitung kemiripan komposisi dan jumlah perubahan
   ↓
Ranking
   ↓
Top 3 + peringkat berikutnya
```

Aturan model/distance dipertahankan: input model mengikuti ordered 18-feature
contract pada metadata; water_pct derived dan dikeluarkan dari input model serta
composition distance. Tidak ada training ulang pada integrasi dashboard.

Bobot ranking existing:

| Sinyal | Bobot |
|---|---:|
| Predicted stability | 50% |
| Formula similarity | 35% |
| Minimal changes | 15% |

Rescue score adalah **ranking score**, bukan probabilitas keberhasilan lab.
Predicted stability bukan jaminan kestabilan nyata.
Historical observed stability dan model prediction ditampilkan sebagai bukti berbeda.

### Output UI

- Komposisi original.
- Ringkasan proses dari respons API, bukan streaming progress per langkah.
- Top 3, estimasi stability, similarity, jumlah perubahan, dan tabel komposisi.
- Kandidat peringkat berikutnya.
- Loading, retry/error, dan empty state tanpa hasil mock pengganti.

Contoh yang sudah diuji: Formula 7 + Plantacare 818 → Top 3 **288, 292, 190**.

### Batas

MVP rescue mencakup shampoo/rinse-off. Tidak menghasilkan formula baru dari nol,
tidak merekomendasikan bahan baru secara bebas, dan tidak memprediksi sensory.
Hasil belum otomatis masuk Dataset Library; state hasil hilang saat meninggalkan
fitur/refresh. Tidak ada penyimpanan riwayat permanen saat ini.

## 5. AI Reformulation — konsep yang akan diintegrasikan

Fitur ini bukan rescue ingredient. **Identitas bahan tetap**, sementara konsentrasi,
rasio, atau parameter proses dapat diubah hanya jika model/evidence mendukungnya.

### Input yang direncanakan

- Produk: nama, kategori, versi bila tersedia.
- Clean insight: feedback ringkas dari marketing; kekuatan dan complaint.
- Formulasi baseline: bahan, peran, konsentrasi, adjustable atau fixed, min/max.
- Process baseline: kondisi pembuatan, satuan, adjustable atau fixed, min/max.
- Pengukuran baseline bila tersedia, dengan unit dan metode pengukuran.
- Targets dan constraints: apa yang ditingkatkan, dipertahankan, dan dibatasi.

### Alur target

```text
Clean insight + existing formula/process
   ↓
Terjemahkan ke technical targets + konfirmasi R&D
   ↓
Pilih model yang kompatibel dengan sistem produk dan unit
   ↓
Generate candidate settings di dalam allowed design space
   ↓
Forward model memperkirakan respons setiap kandidat
   ↓
Buang kandidat di luar constraints/evidence domain
   ↓
Ranking berdasarkan target, trade-off, dan minimal change
   ↓
Top 3 recommended experiments + evidence + limitations
   ↓
Lab validation [direncanakan]
```

**Insight translator:** menjelaskan apa yang ingin diperbaiki, bukan langsung
menentukan konsentrasi. MVP dapat memakai mapping terstruktur/rules dengan
konfirmasi R&D; tidak perlu otomatis menambahkan LLM/RAG.

**Forward model:** belajar hubungan composition/process → product responses.
Teks feedback bukan target training dari model formulasi.

**Optimizer:** membuat/menguji banyak kombinasi dengan model lalu memilih kandidat.
Optimizer berbeda dari model prediksi. Grid/random/LHS search bisa menjadi awal;
algoritma final dan bobot ranking belum dikunci. Jangan menyalin bobot rescue
secara otomatis karena objective reformulation berbeda.

### Pilot model yang disarankan: Mercurio

Pilihan ini adalah fokus awal yang disarankan, bukan model yang sudah tersambung.

| Model input | Range menurut methodology |
|---|---:|
| Phytantriol | 0–3% |
| Soy lecithin | 0–3% |
| Caprylic/capric triglycerides (CCT) | 0–5% |

Output: hydration, stickiness, oiliness, consistency sesuai definisi sumber.
Range, persamaan, unit, dan faktor coded/actual harus diverifikasi dari dataset
dan evidence sebelum training/inference.

Model ini tidak universal untuk semua cosmetic cream.
Brightening, tightness, dan phase stability tidak otomatis menjadi output Mercurio.
Mempertahankan konsentrasi active **tidak membuktikan efficacy tetap sama**.
Target yang tidak dimodelkan harus ditandai belum dievaluasi/perlu lab validation.

Pengubahan konsentrasi juga memerlukan mass balance; base/water penyeimbang harus
ditentukan eksplisit. Jangan menganggap tiga faktor merupakan formula lengkap.

### Output yang direncanakan

- Technical targets yang dikonfirmasi.
- Perubahan baseline vs candidate.
- Predicted responses dan trade-off yang benar-benar didukung.
- Source study, model version, data origin, valid range, dan limitations.
- Tes lab yang diperlukan.

Delta ideal membandingkan prediksi baseline dan kandidat dari model yang sama.
Perbandingan terhadap pengukuran nyata memerlukan unit/protokol yang kompatibel;
jangan mengurangi dua angka dari skala/metode berbeda.

## 6. Dataset dan evidence

Sumber reformulation: [dataset methodology](Consumer_Guided_Formulation_Optimization_Dataset_Methodology.md)
dan workbook Phase2_500_Prototype_Training_Dataset.xlsx.

Menurut methodology, komposisinya:

| Block | Measured | Generated dari persamaan | Total |
|---|---:|---:|---:|
| Mercurio | 0 | 153 | 153 |
| Oliveira | 17 | 153 | 170 |
| Anicescu | 13 | 152 | 165 |
| Chow | 12 | 0 | 12 |
| Total | 42 | 458 | 500 |

500 records **bukan 500 eksperimen independen**. Angka di atas adalah keterangan
methodology, bukan hasil audit baru seluruh workbook dalam pengerjaan dokumen ini.

Study memiliki sistem dan output berbeda: jangan gabungkan sebagai model universal.
Simpan study_id, source_doi/url, data_origin, generation_method, valid_factor_range,
relation_id, unit, dan penanda empirical ground truth.

Training pada data generated terutama mengajari model meniru persamaan sumber.
Random holdout synthetic yang akurat **bukan bukti akurasi pada eksperimen lab baru**.
Evaluasi empiris memerlukan pengukuran independen yang tidak bocor dari training
atau persamaan pembentuk data. Published equations yang fit pada measured rows
juga dapat membawa informasi dari measured test rows—pisah dan ungkapkan batasnya.

Mercurio saat ini tidak memiliki measured row-level ground truth pada dataset ini.
Kualitas surrogate approximation dan empirical validation harus dilaporkan terpisah.

## 7. Dataset Library — tampilan dan rencana penyimpanan

Library berarti tempat menelusuri data kerja, bukan otomatis tabel training model.

| Tab | Isi target | Hubungan ke sistem |
|---|---|---|
| Clear Insight | Insight bersih, product context, technical targets, tanggal | Dipilih sebagai input AI Reformulation |
| Formula Rescue | Input constraint, original formula, ranking candidates, model version | Riwayat hasil rescue nyata |
| AI Reformulation | Baseline, targets, candidates, evidence, lab results | Riwayat optimization dan eksperimen |

Saat ini tiga tab berisi **fixture demo**, bukan riwayat backend.
Belum ada form penyimpanan clean insight, pemilihan insight ke model, atau
pencatatan rescue result otomatis.

### Cara pengguna melihat data

- Kartu memiliki judul yang dapat diklik, ringkasan, dan visual chart.
- Sort by date: terbaru/terlama; waktu tampil WIB, timestamp sesi UTC.
- Klik judul → **Simple Mode** berupa tabel atribut, baseline, kandidat, unit, catatan.
- Clear Insight menampilkan targets; angka belum diukur tidak diada-adakan.
- Rescue menampilkan stability/similarity/composition; bukan sensory palsu.
- **Session Detail** → input/output JSON dan metadata yang aman ditampilkan.
- Menu ⋯ → download results CSV atau session JSON.

Chart demo sekarang memakai angka dummy dan skala per atribut.
Saat diganti data nyata, pertahankan units/evidence; chart bukan proof of efficacy.
CSV/JSON demo menyertakan label demo, bukan hasil model/lab.

### Public view vs advanced

Simple/advanced adalah **pilihan tampilan**, bukan permission boundary.
Jika nanti ada public view sungguhan, hanya tampilkan dataset yang telah
disanitasi/disetujui; formula perusahaan, feedback personal, tokens/passwords,
dan internal logs tidak boleh terbuka hanya karena pengguna mengklik Session Detail.
Scope public sharing, real authentication, dan role access belum dibangun.

## 8. Arsitektur teknis yang berjalan sekarang

Frontend adalah tampilan/input. API adalah jalur request/response.
Backend menjalankan validasi dan aturan/model. Database menyimpan data permanen;
database aplikasi belum diintegrasikan saat ini.

```text
Browser
   ↓
Next.js utama (frontend/)
   ├── UI dashboard, demo login, library, Formula Rescue
   └── /api/formula-rescue/* — server-side connector
             ↓ HTTPS
      FastAPI lama di Vercel
             ↓
      Rescue Engine → model XGBoost + processed shampoo data
```

Frontend connector tidak menjalankan XGBoost dan tidak menduplikasi ranking.
Browser memanggil same-origin Next.js; server meneruskan ke endpoint fixed API lama.
Ini menghindari ketergantungan browser pada CORS API lama, bukan menambahkan login.

API upstream existing:
https://formula-rescue-api-gold.vercel.app

Browser routes:

- GET /api/formula-rescue/health → GET /health.
- GET /api/formula-rescue/formulas → GET /formulas.
- POST /api/formula-rescue/reformulate → POST /reformulate.

Server env: FORMULARESCUE_API_URL. Default mengarah ke upstream di atas.
NEXT_PUBLIC_API_BASE_URL tidak digunakan oleh konektor rescue baru.
Environment variable server bukan berarti URL backend adalah secret.

Folder Hackathon/ menyimpan source backend/frontend/model rescue lama.
**Keberadaan folder tidak otomatis menjalankan atau men-deploy backend**.
Aplikasi utama memakai frontend/; frontend dalam Hackathon/ menjadi referensi reuse.

## 9. Arsitektur target — belum seluruhnya dibangun

```text
Satu frontend Next.js + connectors
   ├── Formula Rescue API → engine/model lama
   ├── AI Reformulation API [planned] → translator + model + optimizer
   └── Library/lab persistence API [planned] → durable database/storage
```

Database permanen diperlukan agar insight, run history, dan lab results bisa
diakses kembali lintas perangkat. PostgreSQL adalah opsi dari README produk,
**belum dipasang atau diputuskan provider-nya** pada tahap ini.

File lokal Vercel dan state React bukan tempat penyimpanan histori permanen.
Connector saja tidak membuat history service.
API reformulation/persistence perlu kontrak yang disepakati sebelum integrasi;
bagian draft API_CONTRACT bukan endpoint yang sudah tersedia.

## 10. Cloudeka → model handover → aplikasi

Workflow yang kita tuju:

1. Siapkan dataset, provenance, unit, split, dan feature/target contract.
2. Training/evaluasi model di notebook Cloudeka sesuai syarat event.
3. Export bundle: trained model, preprocessing, metadata, metrics, dependency
   versions, valid ranges, dan sample input/output.
4. Bawa bundle ke backend development; uji inference CPU pada runtime bersih.
5. Backend menerima input valid, memakai preprocessing/model yang sama,
   menjalankan optimizer, lalu mengirim output terstruktur ke frontend.

Training berarti belajar dari dataset; inference berarti memakai model tersimpan
untuk memprediksi input baru. Aplikasi tidak melakukan training tiap user klik Run.

Notebook Cloudeka bukan otomatis server produksi. Dengan model CPU-compatible
yang sudah diekspor dan disajikan backend, notebook tidak harus selalu menyala.
Jangan mengganti metric Cloudeka dengan angka fixture UI.

Untuk rescue existing, integrasi saat ini memakai artifact/backend lama;
dokumen ini tidak mengklaim ada training Cloudeka baru yang sudah dilakukan.
Format/algoritma final model reformulation masih menunggu pengembangan model.

## 11. Deployment dan GitHub

GitHub menyimpan source dan memfasilitasi kerja tim, bukan menjalankan backend
hanya karena file sudah di-push. Model bundle/data berlisensi sensitif perlu
aturan akses dan handover yang jelas; jangan commit secrets/private datasets.

Kondisi deployment:

- Backend Formula Rescue lama sudah berada di Vercel.
- Frontend dashboard baru sudah build lokal, **belum di-deploy pada tahap integrasi**.
- AI Reformulation backend belum terhubung.
- Belum ada backend persistence library/lab.
- Root Spontan-Team belum Git repository saat pemeriksaan terakhir.

Untuk frontend baru: import repo yang memuat frontend utama ke Vercel;
Framework Next.js, Root Directory frontend. Konektor server ikut deployment Next.js.
Tidak perlu memasukkan folder model Python ke bundle frontend.

Vercel frontend dapat memakai upstream rescue lama tanpa redeploy backend.
Perubahan backend/model nantinya membutuhkan workflow deploy backend sendiri.
Frontend atau connector yang berubah memerlukan deployment frontend baru.

Dengan frontend dan backend cloud tersedia, laptop/tunnel tidak harus menyala.
Kalau upstream disetel ke localhost, kondisi ini tidak berlaku.
Jangan memakai localhost sebagai upstream production Vercel.

Makna syarat event “deployment local” dan apakah Vercel diperbolehkan masih perlu
konfirmasi panitia; preferensi platform bukan bukti kepatuhan aturan hackathon.

## 12. Lab validation dan closed learning loop [planned]

```text
AI recommended experiment
   ↓
R&D membuat batch/prototype
   ↓
Lab mengukur properties dengan metode dan unit yang dicatat
   ↓
Simpan measured results + accepted/rejected + notes
   ↓
Bandingkan prediction vs measurement
   ↓
Kurasi dataset untuk training berikutnya
```

Measured record minimal mencatat formula/process version, batch/experiment ID,
tanggal, operator, instrument/method, replicate/uncertainty bila tersedia,
dan actual responses. Predicted output tidak boleh disimpan sebagai measured.

Hasil disimpan permanen setelah persistence dibangun.
Data baru tidak otomatis memperbaiki model; retraining/evaluasi terpisah dan
terkontrol diperlukan. Ganti model hanya setelah verifikasi dan versioning.

## 13. Status implementasi

| Bagian | Status saat dokumen dibuat |
|---|---|
| Login, dashboard, sidebar bersama | UI berjalan lokal; login demo |
| Formula Rescue dalam tema baru | Terintegrasi API nyata, model/engine lama |
| AI Reformulation page | Placeholder dalam pengembangan |
| Model/optimizer reformulation | Belum terhubung ke aplikasi |
| Dataset Library, chart, tabel, Session Detail, download | UI demo dengan fixture |
| Clear Insight → input run reformulation | Direncanakan, belum wired |
| Rescue/reformulation history permanen | Belum tersedia |
| Lab input dan measured persistence | Direncanakan |
| Real auth, access roles, public data permissions | Belum tersedia |
| Deployment dashboard baru | Belum dilakukan pada checkpoint ini |

Laporan integrasi mencatat 22 backend tests, frontend typecheck/build, dan HTTP
nyata melalui konektor lokal berhasil. Itu bukti engineering, bukan validitas
ilmiah universal. UI browser/manual mobile masih perlu diverifikasi pengguna.

## 14. Keamanan dan batas scientific

Proteksi konektor saat ini: endpoint fixed, bounds pagination, JSON maksimal
8 KiB, ingredient maksimal 200 karakter, top_k 1–10, timeout upstream 45 detik,
dan error internal tidak diteruskan ke browser.

Sebelum public sharing lebih luas: real auth bila data privat, rate limiting,
resource/cost monitoring, izin download, sanitasi session logs, HTTPS,
dependency review, dan readiness yang benar-benar mengecek model.
Health HTTP 200 sendiri tidak membuktikan model tersedia atau prediksi valid.

Tidak boleh:

- Membuat fallback mock saat request nyata gagal.
- Menyebut dummy metrics sebagai evaluation/model results.
- Mengklaim ranking score sebagai probability of lab success.
- Mencampur measured, equation-derived, dan demo data.
- Menggunakan model shampoo untuk emulsion sensory atau sebaliknya.
- Menganggap formula aman/regulatory-approved atau efficacy terjamin.
- Menampilkan angka untuk unsupported targets atau mengekstrapolasi di luar evidence.

## 15. Urutan pengembangan berikutnya

1. Verifikasi UI Formula Rescue di browser/HP dan error state.
2. Sepakati kontrak insight, run history, persistence, serta public/private data.
3. Siapkan dan verifikasi model reformulation dari Cloudeka beserta handover.
4. Implement bounded optimizer dan API reformulation; uji satu formula kompatibel.
5. Hubungkan form reformulation dan hasil nyata ke frontend satu tema.
6. Implement library/lab persistence dan pencatatan session yang disanitasi.
7. Deploy dashboard, uji dari perangkat/jaringan berbeda, lalu hardening sesuai scope.

Setiap tahap dikerjakan terpisah: jelaskan → implement → test → checkpoint → stop.
Dokumen ini tidak memberikan izin otomatis untuk database/auth/deploy/retrain baru.

## 16. Referensi internal

- [PROJECT_SPEC.md](PROJECT_SPEC.md): rules gate dan keputusan event yang masih TBD.
- [README reformulation](README_Codex_Formulation_Optimization.md): konteks produk reformulation.
- [Methodology dataset](Consumer_Guided_Formulation_Optimization_Dataset_Methodology.md): evidence dan batas data.
- [FormulaRescue spec](Hackathon/FORMULARESCUE_MVP_SPEC.md): aturan domain rescue lama.
- [API contract](docs/API_CONTRACT.md): konektor rescue implemented vs draft reformulation.
- [Integration report](FORMULA_RESCUE_INTEGRATION_REPORT.md): implementasi dan bukti tes.
- [Frontend guide](frontend/README.md): menjalankan lokal dan konfigurasi Vercel.

**Ringkasnya:** satu workspace, dua engine untuk masalah yang berbeda, satu library
untuk jejak data dan eksperimen; AI mengusulkan, R&D memutuskan, lab memvalidasi.
