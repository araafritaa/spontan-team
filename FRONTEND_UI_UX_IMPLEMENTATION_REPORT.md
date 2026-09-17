# Implementasi konsep frontend Spontan

Sumber: `Spontan_AI_Formulation_UI_UX_Explanation.md`.

## Yang diimplementasikan

- Dashboard tiga modul: Formula Rescue, AI Reformulation, Dataset Library.
- Tema putih, biru laut, cyan dipertahankan. Navigasi tahap dapat scroll di layar kecil;
  form/sidebar berubah menjadi satu kolom dan tabel dapat digeser horizontal.
- AI Reformulation berupa wizard tujuh tahap: Product, Clean Insight, Baseline,
  Engine Review, Recommendations, Evidence, Lab Validation.
- Clean Insight dari library demo dapat dipakai sebagai input draft.
- Target teknis dipilih manual dan dikonfirmasi R&D, bukan diterjemahkan AI.
- Baseline tiga faktor memiliki concentration, fixed/adjustable, min/max,
  serta process context. Bukan formula lengkap atau process optimizer.
- Validasi input kosong, angka finite, rentang, total faktor, dan process context.
  Perubahan input mengunci kembali tahap sesudahnya.
- Lab-plan dapat didownload sebagai JSON dengan model_executed=false,
  candidate_id=null, measured_results=null. Tidak ada lab success palsu.
- Formula Rescue tetap memakai penghubung API lama; model/ranking tidak diubah.

## Batas implementasi

AI Reformulation belum terhubung model/optimizer. Generate dinonaktifkan;
Top 3 dan evidence adalah empty state, bukan kandidat buatan.
Cost, sustainability, safety, brightening, stability, dan contoh peningkatan +15%
tidak diklaim sebagai keluaran model sensory.
Form validation hanya memeriksa input UI, bukan kelayakan ilmiah/design domain.
Login masih demo. Library tetap fixture, tanpa database atau history baru.
Draft hilang saat refresh/meninggalkan fitur. Lab validation permanen,
knowledge update, dan retraining belum dibuat. Tidak ada deploy/push pada tahap ini.

## Verifikasi

- TypeScript dan production build diperiksa dengan npm run typecheck/build.
- Fungsi validasi diuji terhadap draft valid, input kosong, konfirmasi,
  nilai NaN, batas adjustable, fixed factor, total di atas 100%, dan process invalid.
- Browser/mobile visual dan download interaktif perlu checkpoint manual;
  build sukses tidak membuktikan perilaku browser atau validitas ilmiah.

## Checkpoint pengguna

1. Jalankan npm run dev di folder frontend, masuk dengan kredensial dummy.
2. Library -> Clear Insight -> klik judul -> Gunakan insight demo di AI Reformulation.
3. Isi/konfirmasi form, lanjut tujuh tahap, coba download lab-plan draft JSON.

Predicted / estimated and requires physical laboratory validation.
