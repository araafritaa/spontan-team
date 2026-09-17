# AI Reformulation — dataset, preprocessing, training & output

## 1. Ringkasan

Model: Polynomial Regression degree 2 + Ridge alpha=0.000001.
Pipeline tersimpan: PolynomialFeatures -> StandardScaler -> Ridge, empat output sekaligus.
Training environment: local_cpu. Ini run lokal CPU, bukan bukti training Cloudeka.
Model belum menggantikan Random Forest di spontan_engine atau dipasang ke backend.

## 2. Dataset dan asal data

Workbook: `Phase2_500_Prototype_Training_Dataset.xlsx`; sheet Training_Master_500; total 500 baris.
Filter hanya study_id=MERCURIO_2020_P2: 153 baris; 153 diterima, 0 ditolak.
Provenance: MODEL_GENERATED_PUBLISHED_EQUATION, bukan hasil ukur lab baru.
Komposisi hanya tiga faktor studi emulsion, bukan formula produk lengkap.
DOI dari workbook: 10.1590/S2175-97902020000318502 (belum diverifikasi ulang terhadap publikasi).
Noise tidak ditambahkan; data measured/synthetic tidak dicampur.

## 3. Input dan output

Urutan input: ['phytantriol_pct', 'soy_lecithin_pct', 'cct_pct']; seluruhnya persen.
Rentang desain: Phytantriol 0–3%, Soy lecithin 0–3%, CCT 0–5%.
Urutan output: ['hydration_ratio', 'stickiness_score_0_10', 'oiliness_score_0_10', 'consistency_index'].
Hydration adalah ratio; stickiness/oiliness skor 0–10.
Unit fisik consistency index perlu dikonfirmasi dari sumber; jangan otomatis menyebutnya viscosity cP.
Row ID, provenance, process settings, nama produk, dan insight teks tidak menjadi fitur model.

## 4. Preprocessing dan EDA

Preprocessing menggunakan fungsi preprocess_mercurio yang sama: cek schema,
filter studi, verifikasi identitas/unit, konversi numeric, tolak missing/nonfinite,
validasi range/target, audit row ID dan duplicate komposisi+respons. Provenance disimpan.
Tidak ada imputation, clipping atau penambahan noise.
Scaling tidak dilakukan sebelum split; StandardScaler di-fit pada fold training saja.
Laporan EDA detail: data/processed/mercurio/MERCURIO_PREPROCESSING_EDA.md.

| Column | count | mean | std | min | 25% | 50% | 75% | max |
|---|---|---|---|---|---|---|---|---|
| phytantriol_pct | 153.00000 | 1.50005 | 0.86930 | 0.01281 | 0.76334 | 1.50766 | 2.24173 | 2.98357 |
| soy_lecithin_pct | 153.00000 | 1.50000 | 0.86874 | 0.01400 | 0.75779 | 1.50849 | 2.24158 | 2.98483 |
| cct_pct | 153.00000 | 2.49944 | 1.44892 | 0.00596 | 1.26853 | 2.48897 | 3.73034 | 4.98491 |
| hydration_ratio | 153.00000 | 1.50000 | 0.05417 | 1.40733 | 1.45372 | 1.50053 | 1.54624 | 1.59259 |
| stickiness_score_0_10 | 153.00000 | 3.06833 | 0.62464 | 1.55192 | 2.73234 | 3.07795 | 3.47245 | 4.75670 |
| oiliness_score_0_10 | 153.00000 | 2.54480 | 0.58153 | 0.87124 | 2.22376 | 2.68139 | 2.94957 | 3.49396 |
| consistency_index | 153.00000 | 27320.04278 | 1412.87855 | 24133.16889 | 26194.81068 | 27295.41938 | 28292.39399 | 30451.60811 |

Korelasi lecithin–hydration pada data ini sempurna; itu mencerminkan data equation-derived,
bukan bukti kausal baru. Hydration maksimum sampel ~1.5926, sehingga target 1.60
tidak boleh dianggap feasible tanpa pemeriksaan engine. Model polynomial tidak membatasi output otomatis.

## 5. Training dan pencegahan leakage

1. GroupShuffleSplit 80/20, seed 42: 122 development dan 31 holdout;
   komposisi identik harus berada pada partisi yang sama.
2. Lima GroupKFold pada development; setiap fold melatih pipeline dari awal.
3. Degree/alpha dibekukan dari benchmark terdahulu; tidak dituning dengan holdout.
4. Model evaluasi di-fit pada 122 baris, lalu memprediksi 31 holdout.
5. Sesudah evaluasi, pipeline export di-fit ulang pada seluruh 153 baris.
   Metrik evaluasi BUKAN hasil inference terhadap training model full-data.

PolynomialFeatures menghasilkan 9 term: 3 konsentrasi, 3 kuadrat, 3 interaksi.
Ridge memakai intercept dan regularisasi lemah, sesuai eksperimen approximation tanpa noise.
Holdout sudah pernah diperiksa saat benchmark: ini reproduksi hasil, bukan test baru yang belum dilihat.

## 6. Hasil evaluasi — bukan classification accuracy

MAE: rata-rata selisih absolut, satuan mengikuti target; lebih kecil lebih baik.
RMSE: lebih sensitif terhadap error besar. R²: kecocokan relatif terhadap variasi target;
R² bukan persentase accuracy dan dapat negatif. Tidak ada accuracy/precision/recall klasifikasi.

| Target | Holdout MAE | Holdout RMSE | Holdout R² | Dummy MAE |
|---|---:|---:|---:|---:|
| hydration_ratio | 1.507822698e-09 | 1.811838123e-09 | 1.000000000000 | 0.04144599 |
| stickiness_score_0_10 | 6.29926671e-08 | 7.704052258e-08 | 1.000000000000 | 0.44456187 |
| oiliness_score_0_10 | 9.12612427e-08 | 1.107991219e-07 | 1.000000000000 | 0.4269925 |
| consistency_index | 4.790157958e-05 | 5.576415074e-05 | 1.000000000000 | 1164.2836 |

| Target | CV MAE mean ± std | CV R² mean ± std |
|---|---:|---:|
| hydration_ratio | 2.3059744e-09 ± 4.0643042e-10 | 1.000000000000 ± 8.513e-16 |
| stickiness_score_0_10 | 1.0170797e-07 ± 2.1338968e-08 | 1.000000000000 ± 1.385e-14 |
| oiliness_score_0_10 | 1.3629327e-07 ± 2.8797208e-08 | 1.000000000000 ± 2.041e-14 |
| consistency_index | 6.1689416e-05 ± 1.2363737e-05 | 1.000000000000 ± 1.907e-15 |

Nilai mendekati sempurna menunjukkan approximation hubungan persamaan pada generated data.
Ini TIDAK berarti formula pasti berhasil, safety terjamin, atau accuracy lab 100%.
Persamaan sumber langsung belum dievaluasi; perlu dibandingkan untuk membenarkan manfaat surrogate ML.
Validasi physical independen masih diperlukan, terutama sebelum retraining dengan hasil aktual.

## 7. Contoh output model full-data

Input: `{"phytantriol_pct": 1.5, "soy_lecithin_pct": 2.5, "cct_pct": 3.0}`.
Output predicted (bukan pengukuran):

```json
{
  "hydration_ratio": 1.5623600002295417,
  "stickiness_score_0_10": 3.2166667222342733,
  "oiliness_score_0_10": 2.6574122962540816,
  "consistency_index": 28816.466649685575
}
```

Checksum dan contoh output/toleransi dicatat dalam metadata/fixture.
Pipeline telah dimuat ulang dan prediksinya cocok dengan model sebelum serialization.
Ukuran artifact 1465 byte; mean prediction ~2.2348 ms pada 100 calls lokal.
Timing hanya pengukuran runtime laptop ini, bukan jaminan server Vercel.

## 8. Handover dan cara verifikasi

Folder artifacts: `ml/artifacts/mercurio_polynomial_ridge_v1`.
sensory_model.joblib mencakup polynomial transformation, scaler, dan regressor.
File pendamping: model_metadata.json, evaluation.json, split_manifest.json,
prediction_example.json, training_data.csv, excluded_rows.csv, holdout_predictions.csv,
runtime-requirements.txt dan laporan ini.
Versi: {'python': '3.12.7', 'scikit_learn': '1.8.0', 'numpy': '2.4.4', 'pandas': '3.0.2', 'scipy': '1.17.1', 'joblib': '1.5.3'}.
requirements runtime dipin dari versi lokal; bukan lock lengkap/security audit.
Training workbook juga memerlukan openpyxl.

Dari root proyek di PowerShell:

```powershell
py -m unittest discover -s ml/tests -v
py ml/predict_mercurio.py
```

Expected: tests lolos dan empat respons predicted sesuai fixture.
Untuk mengulang training, gunakan direktori output baru agar tidak menimpa model:

```powershell
py ml/train_mercurio.py --output ml/artifacts/mercurio_polynomial_ridge_v2
```

Cloudeka/Linux: ganti py dengan python; --environment cloudeka mencatat deklarasi,
bukan bukti otomatis. Simpan log/notebook dan bukti event yang diperlukan.
Hanya load joblib yang dibuat tim sendiri; pickle/joblib dapat menjalankan kode.
Predictor menolak input invalid/out-of-domain serta output tidak masuk batas fisik minimum,
tanpa diam-diam clipping. Belum ada optimasi, API baru, deployment, robot lab atau persistence.

Predicted / estimated and requires physical laboratory validation.
