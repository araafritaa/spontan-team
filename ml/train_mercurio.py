"""Evaluate frozen Polynomial/Ridge configuration, then export a full-data pipeline."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import platform
from pathlib import Path
import time

import joblib
import numpy as np
import pandas as pd
import scipy
import sklearn
from sklearn.base import clone
from sklearn.dummy import DummyRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold

from benchmark_mercurio import candidates, split_indices
from preprocess_mercurio import ROOT, FEATURES, TARGETS, STUDY, RANGES, DISCLAIMER, preprocess, table

VERSION = 'mercurio_polynomial_ridge_v1'


def metrics(truth, prediction):
    return {target: {'mae': float(mean_absolute_error(truth[:, i], prediction[:, i])),
                     'rmse': float(np.sqrt(mean_squared_error(truth[:, i], prediction[:, i]))),
                     'r2': float(r2_score(truth[:, i], prediction[:, i]))}
            for i, target in enumerate(TARGETS)}


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False), encoding='utf-8')


def run(workbook, output, environment):
    if output.exists() and any(output.iterdir()):
        raise ValueError('Output already populated; choose a new --output directory to preserve artifacts.')
    raw = pd.read_excel(workbook, sheet_name='Training_Master_500', engine='openpyxl')
    frame, excluded, selected = preprocess(raw)
    if not frame.data_origin.eq('MODEL_GENERATED_PUBLISHED_EQUATION').all():
        raise ValueError('Unexpected data origin; review training contract before proceeding.')
    if frame.is_empirical_ground_truth.astype(str).str.lower().ne('false').any():
        raise ValueError('Measured/generated data must not be mixed silently.')
    train, test, groups = split_indices(frame)
    X = frame[list(FEATURES.values())]
    Y = frame[TARGETS].to_numpy()
    template = candidates()['Polynomial2_Ridge']
    folds = []
    for fold, (fit, valid) in enumerate(GroupKFold(n_splits=5, shuffle=True, random_state=42).split(X.iloc[train], groups=groups[train]), 1):
        model = clone(template).fit(X.iloc[train[fit]], Y[train[fit]])
        baseline = DummyRegressor().fit(X.iloc[train[fit]], Y[train[fit]])
        folds.append({'fold': fold, 'train_row_ids': frame.iloc[train[fit]].row_id.tolist(),
                      'validation_row_ids': frame.iloc[train[valid]].row_id.tolist(),
                      'model': metrics(Y[train[valid]], model.predict(X.iloc[train[valid]])),
                      'dummy': metrics(Y[train[valid]], baseline.predict(X.iloc[train[valid]]))})
    evaluation_model = clone(template).fit(X.iloc[train], Y[train])
    predictions = evaluation_model.predict(X.iloc[test])
    baseline = DummyRegressor().fit(X.iloc[train], Y[train])
    evaluation = {'evaluation_rows': {'train': len(train), 'holdout': len(test)},
                  'evaluation_model': 'Fitted on development rows only; never the full-data artifact',
                  'holdout': metrics(Y[test], predictions),
                  'dummy_holdout': metrics(Y[test], baseline.predict(X.iloc[test])),
                  'development_cv': {t: {m: {'mean': float(np.mean([f['model'][t][m] for f in folds])),
                                             'std': float(np.std([f['model'][t][m] for f in folds]))}
                                        for m in ('mae', 'rmse', 'r2')} for t in TARGETS},
                  'holdout_status': 'Previously inspected in model benchmark; reused without tuning, not a fresh independent confirmation',
                  'interpretation': 'Approximation of generated published-equation responses; NOT independent laboratory validation'}
    # Serving export uses all accepted rows AFTER evaluation. No evaluation from its training predictions.
    start = time.perf_counter()
    final_model = clone(template).fit(X, Y)
    fit_seconds = time.perf_counter() - start
    output.mkdir(parents=True, exist_ok=True)
    model_path = output / 'sensory_model.joblib'
    joblib.dump(final_model, model_path, compress=3)
    reloaded = joblib.load(model_path)  # Only this team-produced artifact, never arbitrary user files.
    example = {'phytantriol_pct': 1.5, 'soy_lecithin_pct': 2.5, 'cct_pct': 3.0}
    example_X = pd.DataFrame([example], columns=list(FEATURES.values()))
    expected = final_model.predict(example_X)
    np.testing.assert_allclose(reloaded.predict(example_X), expected, rtol=1e-10, atol=1e-8)
    start = time.perf_counter()
    for _ in range(100): reloaded.predict(example_X)
    latency_ms = (time.perf_counter() - start) * 10
    versions = {'python': platform.python_version(), 'scikit_learn': sklearn.__version__,
                'numpy': np.__version__, 'pandas': pd.__version__, 'scipy': scipy.__version__, 'joblib': joblib.__version__}
    metadata = {'model_version': VERSION, 'model_type': 'PolynomialFeatures + StandardScaler + Ridge (multi-output regression)',
                'created_at_utc': datetime.now(timezone.utc).isoformat(), 'environment_declared': environment,
                'cloudeka_training_evidence': 'Not collected by this script; local run is not Cloudeka evidence',
                'feature_order': list(FEATURES.values()), 'target_order': TARGETS, 'feature_ranges_pct': RANGES,
                'target_units': {'hydration_ratio': 'ratio', 'stickiness_score_0_10': 'score 0-10',
                                 'oiliness_score_0_10': 'score 0-10', 'consistency_index': 'source-defined; physical unit unverified'},
                'degree': 2, 'include_bias': False, 'ridge_alpha': 1e-6, 'fit_intercept': True,
                'polynomial_terms': final_model[0].get_feature_names_out(list(FEATURES.values())).tolist(),
                'seed_for_split': 42, 'final_training_rows': len(frame), 'evaluation_training_rows': len(train), 'holdout_rows': len(test),
                'study_id': STUDY, 'data_origin': 'MODEL_GENERATED_PUBLISHED_EQUATION', 'noise_added': False,
                'workbook_sha256': hashlib.sha256(workbook.read_bytes()).hexdigest(),
                'model_sha256': hashlib.sha256(model_path.read_bytes()).hexdigest(),
                'model_bytes': model_path.stat().st_size, 'full_data_fit_seconds': fit_seconds,
                'mean_single_prediction_ms_100_calls': latency_ms, 'versions': versions,
                'missing_value_policy': 'Reject missing/nonfinite input; no imputation',
                'input_policy': 'Exact three features, numeric nonboolean, finite, inside design range',
                'output_policy': 'Reject nonfinite/negative responses and sensory scores outside 0-10; never silently clip',
                'disclaimer': DISCLAIMER}
    frame.to_csv(output / 'training_data.csv', index=False)
    excluded.to_csv(output / 'excluded_rows.csv', index=False)
    holdout_frame = frame.iloc[test][['row_id', *FEATURES.values()]].copy()
    for i, target in enumerate(TARGETS):
        holdout_frame[target + '_actual'] = Y[test, i]
        holdout_frame[target + '_predicted'] = predictions[:, i]
    holdout_frame.to_csv(output / 'holdout_predictions.csv', index=False)
    save_json(output / 'model_metadata.json', metadata)
    save_json(output / 'evaluation.json', evaluation)
    save_json(output / 'split_manifest.json', {'development_row_ids': frame.iloc[train].row_id.tolist(),
                                               'holdout_row_ids': frame.iloc[test].row_id.tolist(), 'cv_folds': folds})
    save_json(output / 'prediction_example.json', {'model_version': VERSION, 'input': example,
                                                   'expected_output': dict(zip(TARGETS, expected[0].tolist())),
                                                   'rtol': 1e-10, 'atol': 1e-8, 'physical_measurement': False, 'disclaimer': DISCLAIMER})
    (output / 'runtime-requirements.txt').write_text('\n'.join(f'{name}=={versions[key]}' for name, key in
        [('numpy','numpy'),('pandas','pandas'),('scipy','scipy'),('scikit-learn','scikit_learn'),('joblib','joblib')]) + '\n', encoding='utf-8')
    rows = ['| Target | Holdout MAE | Holdout RMSE | Holdout R² | Dummy MAE |', '|---|---:|---:|---:|---:|']
    for t in TARGETS:
        m = evaluation['holdout'][t]
        rows.append(f'| {t} | {m["mae"]:.10g} | {m["rmse"]:.10g} | {m["r2"]:.12f} | {evaluation["dummy_holdout"][t]["mae"]:.8g} |')
    cvrows = ['| Target | CV MAE mean ± std | CV R² mean ± std |', '|---|---:|---:|']
    for t in TARGETS:
        m = evaluation['development_cv'][t]
        cvrows.append(f'| {t} | {m["mae"]["mean"]:.8g} ± {m["mae"]["std"]:.8g} | {m["r2"]["mean"]:.12f} ± {m["r2"]["std"]:.4g} |')
    report = f'''# AI Reformulation — dataset, preprocessing, training & output

## 1. Ringkasan

Model: Polynomial Regression degree 2 + Ridge alpha=0.000001.
Pipeline tersimpan: PolynomialFeatures -> StandardScaler -> Ridge, empat output sekaligus.
Training environment: {environment}. Ini run lokal CPU, bukan bukti training Cloudeka.
Model belum menggantikan Random Forest di spontan_engine atau dipasang ke backend.

## 2. Dataset dan asal data

Workbook: `{workbook.name}`; sheet Training_Master_500; total {len(raw)} baris.
Filter hanya study_id={STUDY}: {len(selected)} baris; {len(frame)} diterima, {len(excluded)} ditolak.
Provenance: MODEL_GENERATED_PUBLISHED_EQUATION, bukan hasil ukur lab baru.
Komposisi hanya tiga faktor studi emulsion, bukan formula produk lengkap.
DOI dari workbook: {', '.join(frame.source_doi.astype(str).unique())} (belum diverifikasi ulang terhadap publikasi).
Noise tidak ditambahkan; data measured/synthetic tidak dicampur.

## 3. Input dan output

Urutan input: {list(FEATURES.values())}; seluruhnya persen.
Rentang desain: Phytantriol 0–3%, Soy lecithin 0–3%, CCT 0–5%.
Urutan output: {TARGETS}.
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

{table(frame[[*FEATURES.values(), *TARGETS]].describe().T)}

Korelasi lecithin–hydration pada data ini sempurna; itu mencerminkan data equation-derived,
bukan bukti kausal baru. Hydration maksimum sampel ~1.5926, sehingga target 1.60
tidak boleh dianggap feasible tanpa pemeriksaan engine. Model polynomial tidak membatasi output otomatis.

## 5. Training dan pencegahan leakage

1. GroupShuffleSplit 80/20, seed 42: {len(train)} development dan {len(test)} holdout;
   komposisi identik harus berada pada partisi yang sama.
2. Lima GroupKFold pada development; setiap fold melatih pipeline dari awal.
3. Degree/alpha dibekukan dari benchmark terdahulu; tidak dituning dengan holdout.
4. Model evaluasi di-fit pada {len(train)} baris, lalu memprediksi {len(test)} holdout.
5. Sesudah evaluasi, pipeline export di-fit ulang pada seluruh {len(frame)} baris.
   Metrik evaluasi BUKAN hasil inference terhadap training model full-data.

PolynomialFeatures menghasilkan 9 term: 3 konsentrasi, 3 kuadrat, 3 interaksi.
Ridge memakai intercept dan regularisasi lemah, sesuai eksperimen approximation tanpa noise.
Holdout sudah pernah diperiksa saat benchmark: ini reproduksi hasil, bukan test baru yang belum dilihat.

## 6. Hasil evaluasi — bukan classification accuracy

MAE: rata-rata selisih absolut, satuan mengikuti target; lebih kecil lebih baik.
RMSE: lebih sensitif terhadap error besar. R²: kecocokan relatif terhadap variasi target;
R² bukan persentase accuracy dan dapat negatif. Tidak ada accuracy/precision/recall klasifikasi.

{chr(10).join(rows)}

{chr(10).join(cvrows)}

Nilai mendekati sempurna menunjukkan approximation hubungan persamaan pada generated data.
Ini TIDAK berarti formula pasti berhasil, safety terjamin, atau accuracy lab 100%.
Persamaan sumber langsung belum dievaluasi; perlu dibandingkan untuk membenarkan manfaat surrogate ML.
Validasi physical independen masih diperlukan, terutama sebelum retraining dengan hasil aktual.

## 7. Contoh output model full-data

Input: `{json.dumps(example)}`.
Output predicted (bukan pengukuran):

```json
{json.dumps(dict(zip(TARGETS, expected[0].tolist())), indent=2)}
```

Checksum dan contoh output/toleransi dicatat dalam metadata/fixture.
Pipeline telah dimuat ulang dan prediksinya cocok dengan model sebelum serialization.
Ukuran artifact {model_path.stat().st_size} byte; mean prediction ~{latency_ms:.4f} ms pada 100 calls lokal.
Timing hanya pengukuran runtime laptop ini, bukan jaminan server Vercel.

## 8. Handover dan cara verifikasi

Folder artifacts: `{output.relative_to(ROOT).as_posix() if output.is_relative_to(ROOT) else output}`.
sensory_model.joblib mencakup polynomial transformation, scaler, dan regressor.
File pendamping: model_metadata.json, evaluation.json, split_manifest.json,
prediction_example.json, training_data.csv, excluded_rows.csv, holdout_predictions.csv,
runtime-requirements.txt dan laporan ini.
Versi: {versions}.
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

{DISCLAIMER}
'''
    (output / 'AI_REFORMULATION_TRAINING_REPORT.md').write_text(report, encoding='utf-8')
    print(json.dumps({'model_version': VERSION, 'holdout': evaluation['holdout'], 'example_output': dict(zip(TARGETS, expected[0].tolist())), 'artifact': str(model_path)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--workbook', type=Path, default=ROOT / 'Phase2_500_Prototype_Training_Dataset.xlsx')
    parser.add_argument('--output', type=Path, default=ROOT / 'ml/artifacts' / VERSION)
    parser.add_argument('--environment', choices=['local_cpu', 'cloudeka'], default='local_cpu')
    args = parser.parse_args()
    run(args.workbook.resolve(), args.output.resolve(), args.environment)
