# Formula Rescue — hasil eksperimen peningkatan model

Tanggal: 17 September 2026. Status: benchmark selesai; tidak ada pergantian model deployment.

## Ringkasan keputusan

**Belum ditemukan peningkatan XGBoost yang cukup kuat untuk mengganti model aplikasi.**
Random Forest adalah kandidat untuk eksperimen berikutnya, bukan winner terverifikasi.
Model lama, preprocessing, 18-feature contract, API, dan ranking tetap dipertahankan.

Benchmark ini dijalankan lokal pada CPU, bukan notebook Cloudeka.
Untuk evidence hackathon, jalankan script yang sama di Cloudeka; jangan memakai
hasil lokal sebagai bukti bahwa training dilakukan di cloud.

## Apa yang dilakukan

- 812 formula existing; 294 stable dan 518 unstable.
- Tidak menambah data sintetis, mengganti label, atau mengubah cleaning.
- Pembanding: majority dummy, Logistic Regression, Random Forest, XGBoost current,
  dan XGBoost dengan tuning terbatas.
- Lima outer test folds; tiga inner folds memilih parameter XGBoost hanya dari training.
- Dua protocol: stratified random split dan ingredient-set group split.
- Group dibuat dari set bahan yang konsentrasinya nonzero; ada 475 groups.
- Same ingredient set tidak tersebar antara train/test pada grouped protocol.
- Ini bukan batch split atau pemisahan berdasarkan jarak konsentrasi; near-neighbor
  dari set bahan berbeda masih dapat tersebar.
- StandardScaler Logistic Regression fit melalui pipeline hanya pada training.
- Tuning mencoba empat kombinasi max_depth 2/4 dan min_child_weight 2/5,
  parameter lain mengikuti baseline. Baseline depth 3 tetap dievaluasi terpisah.
- Semua hasil memakai threshold 0.5. Calibration/threshold optimization belum dilakukan.
- Tidak membuat model final baru; hanya model temporer per fold untuk evaluasi.

## Hasil utama

Angka di bawah adalah mean lima outer test folds, bukan accuracy training.

| Protocol | Model | Accuracy | ROC-AUC | F1 |
|---|---|---:|---:|---:|
| Random stratified | XGBoost current | 77.83% | 0.8315 | 0.6759 |
| Random stratified | XGBoost tuned | 77.22% | 0.8319 | 0.6667 |
| Random stratified | Random Forest | 77.09% | 0.8308 | 0.6566 |
| Ingredient grouped | XGBoost current | 75.73% | 0.8074 | 0.6332 |
| Ingredient grouped | XGBoost tuned | 75.98% | 0.8082 | 0.6354 |
| Ingredient grouped | Random Forest | 77.21% | 0.8115 | 0.6471 |

Tuning vs current:
- Random: accuracy turun 0.62 percentage points; ROC-AUC naik sekitar 0.0004.
- Grouped: accuracy naik sekitar 0.25 percentage points; ROC-AUC naik sekitar 0.0009.

Random Forest pada grouped evaluation mengurangi false positives pooled
dari 78 menjadi 67. False negatives turun dari 119 menjadi 118.
Itu hasil dari 812 outer-test predictions per model, bukan test set lama 163 rows.
Precision stable pooled: RF 72.43% vs XGBoost current 69.17%;
recall: RF 59.86% vs XGBoost current 59.52%.

RF grouped ROC-AUC std = 0.0635; XGBoost current = 0.0522.
Perbedaan mean kecil dibanding variasi antarfold. Belum ada significance test,
confidence interval, atau external confirmation untuk menyatakan superiority.

## Mengapa bukan 80.98% seperti laporan lama?

80.98% adalah accuracy dari **satu holdout lama berisi 163 formula**.
77.83% adalah **rata-rata lima fold acak pada benchmark ini**.
75.73% adalah **rata-rata lima fold ingredient-grouped**.

Jangan menyimpulkan model rusak hanya karena angka berbeda.
Protocol, training subset, dan test subset berbeda. Untuk perbandingan adil,
gunakan model yang dievaluasi pada folds yang sama dalam tabel benchmark.

Skor XGBoost current di benchmark berasal dari model baru yang fit pada training
fold menggunakan konfigurasi existing, bukan model deployment full-data yang
diuji pada formula yang sudah dilihat. Model final deployed tetap tidak disentuh.

## Batas scientific dan selection bias

- Dataset sudah pernah dianalisis; nested CV menghindari tuning ke outer-test fold,
  tetapi tidak menciptakan independent dataset baru.
- Membandingkan banyak model lalu memilih mean terbaik menambahkan selection bias.
  Konfirmasi di measured data/batch eksternal sebelum keputusan final.
- Group signature proxy, bukan bukti generalisasi ke seluruh domain formula baru.
- Accuracy/AUC classifier bukan hasil pengujian keberhasilan Top3 rescue di lab.
- Semua kandidat rescue existing adalah historis; skor model final pada kandidat
  bukan bukti unseen generalization.
- Brier dihitung sebagai diagnostic probabilistic prediction; belum ada calibration
  fitting atau reliability-curve analysis.
- Tidak ada prediksi sensory, safety, regulatory, long-term stability, atau efficacy.

## File dan cara memeriksa

- [Script benchmark](Hackathon/ml/benchmark_stability.py).
- [Tests benchmark](Hackathon/tests/test_model_benchmark.py).
- [Laporan lengkap](Hackathon/ml/benchmarks/stability_v1/REPORT.md).
- [Metrics per fold dan parameters](Hackathon/ml/benchmarks/stability_v1/metrics.json).
- [Prediksi outer-test per formula](Hackathon/ml/benchmarks/stability_v1/predictions.csv).
- [Manifest train/test folds](Hackathon/ml/benchmarks/stability_v1/split_manifest.json).

Dari terminal PowerShell pada folder Hackathon:

    cd D:\Spontan-Team\Hackathon
    py -m unittest discover -s tests -v

Hasil verifikasi: **25 tests passed**, termasuk tiga tests benchmark baru.
Pemeriksaan tambahan berhasil: semua model/protocol memiliki satu outer-test
prediction per row; group overlap nol; urutan fitur cocok; hashes deployed artifact
sebelum/sesudah identik.

Untuk rerun tanpa menimpa hasil pertama:

    py -m ml.benchmark_stability --output ml/benchmarks/stability_v2

Di terminal notebook Cloudeka dari root Formula Rescue:

    python -m ml.benchmark_stability --output ml/benchmarks/cloudeka_v1

CPU dipilih karena ukuran data kecil; GPU bukan syarat meningkatnya accuracy.
Paket existing sudah cukup pada lingkungan lokal. Versi library actual tercatat
dalam metrics.json untuk reproduksi; perbedaan versi dapat mengubah hasil.

Output directory existing ditolak. Tidak menimpa model/metrics deployment lama.
Tidak ada push, deploy, atau perubahan frontend pada tahap ini.

## Rekomendasi tahap berikutnya

1. Prioritaskan independent measured data: batch, protocol, conditions, replicate,
   dan label stability yang konsisten.
2. Uji RF vs XGBoost pada confirmation data, terutama risiko false positive.
3. Uji calibration/threshold dengan pemilihan hanya di training/inner folds,
   bila ingin memperbaiki makna skor atau trade-off precision/recall.
4. Evaluasi ranking Top3 dengan eksperimen lab atau protocol backtesting yang jelas.
5. Jika bukti cukup: simpan artifact kandidat terpisah, uji backend dan clean runtime,
   lalu minta persetujuan sebelum mengganti model deployed.

> Predicted / estimated and requires physical laboratory validation.
