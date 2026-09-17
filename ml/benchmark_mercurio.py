"""Local exploratory benchmark; no deployed artifacts are changed."""
import argparse
import hashlib
import json
import platform
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler

from preprocess_mercurio import ROOT, FEATURES, TARGETS, STUDY, RANGES, DISCLAIMER


def candidates():
    return {
        'Dummy_mean': DummyRegressor(strategy='mean'),
        'Ridge_linear': make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        # Fixed weak regularization; not tuned on holdout. Generated targets are noise-free.
        'Polynomial2_Ridge': make_pipeline(PolynomialFeatures(degree=2, include_bias=False), StandardScaler(), Ridge(alpha=1e-6)),
        'RandomForest': RandomForestRegressor(n_estimators=500, min_samples_leaf=3, random_state=42, n_jobs=2),
    }


def split_indices(frame):
    groups = frame.groupby(list(FEATURES.values()), sort=False).ngroup().to_numpy()
    train, test = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=42).split(frame, groups=groups))
    return train, test, groups


def score_rows(name, partition, truth, prediction, fold=None):
    return [{'model':name,'partition':partition,'fold':fold,'target':target,
             'mae':float(mean_absolute_error(truth[:,i],prediction[:,i])),
             'r2':float(r2_score(truth[:,i],prediction[:,i]))}
            for i,target in enumerate(TARGETS)]


def run(data_path, output):
    frame=pd.read_csv(data_path)
    columns=[*FEATURES.values(),*TARGETS]
    if frame.empty or not frame.study_id.eq(STUDY).all(): raise ValueError('Mercurio-only data required')
    if not np.isfinite(frame[columns].to_numpy(dtype=float)).all(): raise ValueError('Nonfinite data')
    if not frame.row_id.is_unique: raise ValueError('Unique row IDs required')
    for col,(lo,hi) in RANGES.items():
        if not frame[col].between(lo,hi).all(): raise ValueError('Outside design range')
    train,test,groups=split_indices(frame)
    X=frame[list(FEATURES.values())];Y=frame[TARGETS].to_numpy()
    folds=list(GroupKFold(n_splits=5,shuffle=True,random_state=42).split(X.iloc[train],groups=groups[train]))
    scores=[]; fitted={}
    for name,template in candidates().items():
        for fold,(fit,valid) in enumerate(folds,1):
            model=clone(template).fit(X.iloc[train[fit]],Y[train[fit]])
            scores.extend(score_rows(name,'development_cv',Y[train[valid]],model.predict(X.iloc[train[valid]]),fold))
        fitted[name]=clone(template).fit(X.iloc[train],Y[train])
    cv=pd.DataFrame(scores)
    selection=cv.groupby('model').r2.mean().sort_values(ascending=False)
    winner=str(selection.index[0])
    # Freeze selection before inspecting any holdout output. Do not tune after this step.
    predictions=[]
    for name,model in fitted.items():
        pred=model.predict(X.iloc[test])
        scores.extend(score_rows(name,'holdout',Y[test],pred))
        for j,index in enumerate(test):
            row={'model':name,'row_id':frame.iloc[index].row_id,'partition':'holdout'}
            for i,target in enumerate(TARGETS):row.update({target+'_actual':float(Y[index,i]),target+'_predicted':float(pred[j,i])})
            predictions.append(row)
    output.mkdir(parents=True,exist_ok=True)
    results=pd.DataFrame(scores);results.to_csv(output/'metrics.csv',index=False)
    pd.DataFrame(predictions).to_csv(output/'holdout_predictions.csv',index=False)
    split={'seed':42,'train_row_ids':frame.iloc[train].row_id.tolist(),'test_row_ids':frame.iloc[test].row_id.tolist(),
           'cv_folds':[{'fold':i,'train_row_ids':frame.iloc[train[a]].row_id.tolist(),'validation_row_ids':frame.iloc[train[b]].row_id.tolist()} for i,(a,b) in enumerate(folds,1)]}
    (output/'split_manifest.json').write_text(json.dumps(split,indent=2),encoding='utf-8')
    metadata={'training_environment':'local CPU; not Cloudeka evidence','data_sha256':hashlib.sha256(data_path.read_bytes()).hexdigest(),
              'selected_by':'mean development-CV R2 over four targets; not holdout','selected_candidate':winner,
              'train_rows':len(train),'holdout_rows':len(test),'features':list(FEATURES.values()),'targets':TARGETS,
              'parameters':{name:str(model) for name,model in candidates().items()},
              'versions':{'python':platform.python_version(),'scikit_learn':sklearn.__version__,'pandas':pd.__version__,'numpy':np.__version__},
              'noise_added':False,'saved_deployment_model':False,'disclaimer':DISCLAIMER}
    (output/'benchmark_metadata.json').write_text(json.dumps(metadata,indent=2,allow_nan=False),encoding='utf-8')
    hold=results[results.partition.eq('holdout')]
    lines=['# AI Reformulation — Mercurio model benchmark','',
           f'Local CPU benchmark: {len(frame)} generated rows; {len(train)} development / {len(test)} holdout.',
           'Same composition-group holdout and five development folds for all four models.',
           'No added noise. Scalers/polynomial pipelines are fitted only within each training fold.',
           '', '## Fixed model configurations', '',
           '- Dummy: training mean per target.',
           '- Linear Ridge: StandardScaler + alpha=1.',
           '- Polynomial Ridge: degree 2, includes pairwise interactions/squares, StandardScaler + alpha=0.000001.',
           '- Random Forest: 500 trees, min_samples_leaf=3, seed=42, CPU n_jobs=2.',
           '- No hyperparameter search; weak polynomial penalty is a declared noise-free approximation baseline, not proof of robustness to measured noise.',
           '', '## Development cross-validation','', '| Model | Mean R² across targets/folds |','|---|---:|']
    lines += [f'| {name} | {value:.8f} |' for name,value in selection.items()]
    lines += ['',f'Candidate selected before holdout inspection: **{winner}**.',
              'Mean R² is only a declared comparison criterion, not a physical utility or guarantee.',
              '', '## Holdout — per target','', '| Model | Target | MAE | R² |','|---|---|---:|---:|']
    lines += [f'| {r.model} | {r.target} | {r.mae:.8f} | {r.r2:.8f} |' for r in hold.itertuples()]
    lines += ['', '## Interpretation and limitations','',
              'MAE is in each target’s original unit; consistency-index errors cannot be compared directly to hydration-ratio errors.',
              'R² is not percentage accuracy. Near-perfect fit on generated equation targets demonstrates approximation, not successful physical formulation.',
              'Hydration is perfectly linearly associated with lecithin in this dataset. Polynomial terms can approximate equation-derived interactions in other responses.',
              'Random Forest also shares splits across differently scaled targets; its default squared-error objective can be dominated by consistency_index. Its result is not proof that all RF variants are inferior.',
              'Polynomial prediction is not bounded: enforce supported input domain and physical output checks before optimizer integration.',
              'Other ingredient identities, process settings, stability, safety, cost and sustainability are outside this model contract.',
              'All rows share published-equation provenance; generated holdout/CV is NOT independent lab validation.',
              'Direct published equations were not executed or verified; compare them before deciding whether an ML surrogate is necessary.',
              'No serialized model or backend replacement is created in this benchmark stage.',
              'For hackathon compliance, repeat the reproducible pipeline in Cloudeka and keep required evidence.',
              '', '## Reproduce','', 'From project root: `py ml/benchmark_mercurio.py` (Linux: `python`).',
              'Outputs: metrics.csv, holdout_predictions.csv, split_manifest.json, benchmark_metadata.json and this report.',
              'Dependencies: numpy, pandas, scikit-learn (tested version recorded in metadata).', '',DISCLAIMER]
    (output/'MERCURIO_MODEL_BENCHMARK_REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(f'Selected via development CV: {winner}')
    print(hold.to_string(index=False))
    print(f'Report: {output / "MERCURIO_MODEL_BENCHMARK_REPORT.md"}')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--data',type=Path,default=ROOT/'data/processed/mercurio/mercurio_clean.csv')
    parser.add_argument('--output',type=Path,default=ROOT/'ml/benchmarks/mercurio_v1')
    args=parser.parse_args();run(args.data.resolve(),args.output.resolve())
