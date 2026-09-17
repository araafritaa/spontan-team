"use client";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { initialDraft, selectProduct, validateStep, buildOptimizationRequest, type ReformulationDraft } from "../lib/reformulation-draft";
import { AI_DISCLAIMER, fetchProductCatalog, predictComposition, optimizeComposition, type ProductCatalog, type ProductProfile, type Prediction, type OptimizationResult, type OptimizationRequest } from "../lib/reformulation-api";
import ReformulationResults, { ResponseTable } from "./reformulation-results";
import type { NewSessionAnalysis } from "../lib/session-analysis";
import CandidateValidation from "./candidate-validation";
import { reformulationValidationContext } from "../lib/validation-context";
const stages = ["Choose Product", "Insight / Reformulation Goal", "Formula & Limits", "AI Processing", "Ranked Candidates", "Lab Validation", "Evidence"];
export default function Reformulation({ initialInsight = "", onAnalysis, onOpenExperimental }: { initialInsight?: string; onAnalysis?: (entry: NewSessionAnalysis) => void; onOpenExperimental?: (recordId: string) => void }) {
  const [draft,setDraft]=useState(()=>initialDraft(initialInsight));
  const [step,setStep]=useState(0); const [furthest,setFurthest]=useState(0); const [error,setError]=useState("");
  const [prediction,setPrediction]=useState<Prediction|null>(null);
  const [catalog,setCatalog]=useState<ProductCatalog|null>(null); const [catalogError,setCatalogError]=useState("");
  const [result,setResult]=useState<OptimizationResult|null>(null);
  const [executedRequest,setExecutedRequest]=useState<OptimizationRequest|null>(null);
  const [selectedId,setSelectedId]=useState("");
  const [busy,setBusy]=useState<"predict"|"optimize"|null>(null);
  const active=useRef<AbortController|null>(null);
  const selectedCandidate=result?.candidates.find(c=>c.candidate_id===selectedId);
  useEffect(()=>{
    const controller=new AbortController();
    void fetchProductCatalog(controller.signal).then(value=>{setCatalog(value);setDraft(current=>current.productId?current:selectProduct(current,value.products[0]));})
      .catch(cause=>{if(!controller.signal.aborted)setCatalogError(cause instanceof Error?cause.message:"Product catalog could not be loaded.");});
    return()=>{controller.abort();active.current?.abort();active.current=null;};
  },[]);
  function update<K extends keyof ReformulationDraft>(key: K, value: ReformulationDraft[K]) {
    active.current?.abort();active.current=null;setBusy(null);
    setDraft(current=>({...current,[key]:value})); setFurthest(Math.min(step,2)); setError("");
    setResult(null);setPrediction(null);setExecutedRequest(null);setSelectedId("");
  }
  function chooseProduct(profile: ProductProfile) {
    active.current?.abort();active.current=null;setBusy(null);setDraft(current=>selectProduct(current,profile));setFurthest(0);setError("");
    setResult(null);setPrediction(null);setExecutedRequest(null);setSelectedId("");
  }
  async function run(kind:"predict"|"optimize") {
    if(active.current)return;
    for(let index=0;index<=2;index++){const message=validateStep(index,draft);if(message){setStep(index);setError(message);return;}}
    const payload=buildOptimizationRequest(draft);
    const controller=new AbortController();active.current=controller;setBusy(kind);setError("");
    if(kind==="optimize"){setResult(null);setExecutedRequest(null);setSelectedId("");setFurthest(3);}
    try{
      if(kind==="predict"){
        const output=await predictComposition(payload.product_id,payload.baseline,controller.signal);
        if(!controller.signal.aborted)setPrediction(output);
      }else{
        const output=await optimizeComposition(payload,controller.signal);
        if(controller.signal.aborted)return;
        setResult(output);setExecutedRequest(payload);setSelectedId(output.candidates[0]?.candidate_id??"");
        setPrediction({model_version:output.model_version,product:output.product,data_origin:output.data_origin,disclaimer:output.disclaimer,predicted_responses:output.baseline.predicted_responses});
        onAnalysis?.({kind:"reformulation",title:`${draft.product} reformulation`,summary:output.candidates.length?`${output.candidates.length} ranked candidates generated from the confirmed numerical target.`:"No candidate met the confirmed numerical target.",status:output.candidates.length?"Completed":"No candidates",insight:draft.insight.trim(),payload:{request:payload,response:output,context:{product_id:draft.productId,brand:draft.brand,product:draft.product,category:draft.category,insight:draft.insight,preserve:draft.preserve,process_context:{temperature:draft.temperature,speed:draft.speed,duration:draft.duration}}}});
        setStep(4);setFurthest(4);
      }
    }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"AI request failed. Please try again.");}
    finally{if(active.current===controller){active.current=null;setBusy(null);}}
  }
  function openLabValidation(candidateId: string) {
    if (!result?.candidates.some(candidate => candidate.candidate_id === candidateId)) return;
    setSelectedId(candidateId); setStep(5); setFurthest(current => Math.max(current, 5)); setError("");
  }
  function next(event: FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    // Revalidate previous steps when a user revisits and edits them.
    for(let index=0;index<=Math.min(step,2);index++){const message=validateStep(index,draft);if(message){setStep(index);setError(message);return;}}
    if(step===3&&!result){setError("Generate recommendations before continuing.");return;}
    if(step===5&&!selectedCandidate){setError("There is no candidate available for a lab plan.");return;}
    const target=step===4&&!selectedCandidate?6:Math.min(step+1,6);setError("");setStep(target);setFurthest(Math.max(furthest,target));
  }
  return <section className="reformulation-feature">
    <p className="eyebrow">CONSUMER-GUIDED EXPERIMENT DESIGN</p><h1>Improve what exists.<br/><span>Plan what comes next.</span></h1>
    <p>AI proposes, R&D decides, laboratory validates.</p>
    <p className="disclaimer">{AI_DISCLAIMER}</p>
    <p className="notice-note"><strong>MODEL API CONNECTED / SYNTHETIC PRODUCT PROFILES</strong> — Predictions and candidates come from the model engine. Product names identify catalog profiles; ingredient factors, baselines and training data are synthetic, not original Paragon formulas. Analysis sessions reset on refresh; saved validation plans remain in Experimental Data.</p>
    <nav className="wizard-steps" aria-label="Reformulation stages">{stages.map((title,index)=><button key={title} disabled={index>furthest||busy!==null||(index===5&&!selectedCandidate)} aria-current={step===index?"step":undefined} onClick={()=>{setStep(index);setError("");}}>{title}</button>)}</nav>
    <div className="wizard-layout"><form className="wizard-panel" onSubmit={next} aria-busy={busy!==null}>
      <fieldset disabled={busy!==null} style={{border:0,padding:0,margin:0,minWidth:0}}>
      <h2>{stages[step]}</h2>
      {step===0&&<><p>Select the brand and existing product that needs improvement. Category and its three synthetic formulation factors follow the selected backend profile.</p>
        {catalogError&&<p className="rescue-error" role="alert">{catalogError}</p>}
        <div className="wizard-field-grid"><div><label htmlFor="product-brand">Choose Brand</label><select id="product-brand" required disabled={!catalog} value={draft.brand} onChange={e=>{const profile=catalog?.products.find(p=>p.brand===e.target.value);if(profile)chooseProduct(profile);}}><option value="">{catalog?"Select brand":"Loading brands…"}</option>{[...new Set(catalog?.products.map(p=>p.brand)??[])].map(brand=><option key={brand} value={brand}>{brand}</option>)}</select></div>
        <div><label htmlFor="product-name">Choose Product</label><select id="product-name" required disabled={!catalog||!draft.brand} value={draft.productId} onChange={e=>{const profile=catalog?.products.find(p=>p.product_id===e.target.value);if(profile)chooseProduct(profile);}}><option value="">Select product</option>{catalog?.products.filter(p=>p.brand===draft.brand).map(p=><option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}</select></div></div>
        <label htmlFor="product-category">Category</label><input id="product-category" readOnly value={draft.category}/>
        <div className="scope-note"><strong>Synthetic prototype profile</strong><p>{catalog?.notice??"Loading evidence boundary from backend…"}</p></div></>}
      {step===1&&<><p>Input validated consumer feedback or an R&amp;D objective that becomes the optimization target.</p>
        <label htmlFor="clean-insight">Insight / Reformulation Goal</label><textarea id="clean-insight" required maxLength={2000} rows={4} value={draft.insight} onChange={e=>{update("insight",e.target.value);update("confirmed",false);}} placeholder="Example: Improve hydration while maintaining the current supported performance."/>
        {draft.insightOrigin==="library"&&<span className="badge">INPUT FROM DATASET LIBRARY</span>}
        <div className="wizard-field-grid"><div><label htmlFor="technical-target">Improve</label><select id="technical-target" value={draft.target} onChange={e=>{update("target",e.target.value as "hydration"|"stickiness");update("confirmed",false);}}><option value="hydration">Hydration</option><option value="stickiness">Stickiness</option></select></div><div><label htmlFor="target-direction">Direction</label><select id="target-direction" value={draft.direction} onChange={e=>{update("direction",e.target.value as "increase"|"decrease");update("confirmed",false);}}><option value="increase">Increase</option><option value="decrease">Decrease</option></select></div></div>
        <label htmlFor="target-value">Numerical target ({draft.target==="hydration"?"hydration ratio":"stickiness score 0–10"})</label>
        <input id="target-value" type="number" required min="0" max={draft.target==="stickiness"?10:1000000} step="any" value={Number.isNaN(draft.targetValue)?"":draft.targetValue} onChange={e=>{update("targetValue",e.target.valueAsNumber);update("confirmed",false);}}/>
        <p className="small-note">Increase sets a minimum ≥ target; Decrease sets a maximum ≤ target. This is an absolute threshold, not a percentage improvement or a guarantee of improvement over baseline. Check the baseline prediction in AI Processing.</p>
        {draft.target==="hydration"&&<><label className="checkbox-label"><input type="checkbox" checked={draft.stickinessLimit!==null} onChange={e=>{update("stickinessLimit",e.target.checked?3.5:null);update("confirmed",false);}}/>Limit stickiness as a trade-off</label>
          {draft.stickinessLimit!==null&&<><label htmlFor="stickiness-limit">Maximum stickiness (score 0–10)</label><input id="stickiness-limit" type="number" min="0" max="10" required step="any" value={Number.isNaN(draft.stickinessLimit)?"":draft.stickinessLimit} onChange={e=>{update("stickinessLimit",e.target.valueAsNumber);update("confirmed",false);}}/></>}</>}
        <label htmlFor="preserve-target">Preserve / context note</label><input id="preserve-target" maxLength={300} value={draft.preserve} onChange={e=>update("preserve",e.target.value)}/>
        <p className="small-note">The model does not translate free-text insights. Active constraints are numerical targets and fixed/bounded ingredient factors; process parameters provide context only.</p>
        <label className="checkbox-label"><input type="checkbox" checked={draft.confirmed} onChange={e=>update("confirmed",e.target.checked)}/>I confirm these technical targets as the R&D objective.</label></>}
      {step===2&&<><p>Factor roles follow the selected category. This table contains three synthetic factors, <strong>not a complete formulation or the original product formula</strong>; base/water mass balance has not been defined.</p>
        <div className="trace-table-wrap"><table className="wizard-table"><caption>Selected profile limits: {draft.ingredients.map(i=>`${i.name} ${i.min}–${i.max}%`).join("; ")}</caption><thead><tr><th>Ingredient factor</th><th>Current %</th><th>Fixed</th><th>Min %</th><th>Max %</th></tr></thead><tbody>{draft.ingredients.map((item,index)=><tr key={item.feature}><th scope="row">{item.name}</th><td><input aria-label={item.name+" concentration"} type="number" required min={item.profileMin} max={item.profileMax} step="any" value={Number.isNaN(item.concentration)?"":item.concentration} onChange={e=>update("ingredients",draft.ingredients.map((row,i)=>i===index?{...row,concentration:e.target.valueAsNumber}:row))}/></td><td><input aria-label={"Fixed "+item.name} type="checkbox" checked={item.fixed} onChange={e=>update("ingredients",draft.ingredients.map((row,i)=>i===index?{...row,fixed:e.target.checked}:row))}/></td>{(["min","max"] as const).map(key=><td key={key}><input aria-label={item.name+" "+key} type="number" required disabled={item.fixed} min={item.profileMin} max={item.profileMax} step="any" value={Number.isNaN(item[key])?"":item[key]} onChange={e=>update("ingredients",draft.ingredients.map((row,i)=>i===index?{...row,[key]:e.target.valueAsNumber}:row))}/></td>)}</tr>)}</tbody></table></div>
        <h3>Process baseline / context only</h3><p>The current model does not predict process changes. These parameters are recorded as context, not active optimization controls.</p>
        <div className="wizard-field-grid">{([["temperature","Temperature (°C)"],["speed","Mixing speed (rpm)"],["duration","Mixing duration (min)"]] as const).map(([key,label])=><div key={key}><label htmlFor={"process-"+key}>{label}</label><input id={"process-"+key} type="number" required min={key==="temperature"?0:0.01} max={key==="temperature"?150:undefined} step="0.01" value={Number.isNaN(draft[key])?"":draft[key]} onChange={e=>update(key,e.target.valueAsNumber)}/></div>)}</div></>}
      {step===3&&<><p><strong>AI Processing:</strong> the trained product-aware Polynomial + Ridge model predicts supported prototype responses, then the bounded optimizer searches adjustments that satisfy the R&amp;D-confirmed numerical target with minimal change.</p><dl className="review-list"><dt>Brand / product</dt><dd>{draft.brand} / {draft.product}</dd><dt>Category</dt><dd>{draft.category}</dd><dt>Technical target</dt><dd>{draft.target}: {draft.direction==="increase"?"≥":"≤"} {draft.targetValue}{draft.target==="hydration"&&draft.stickinessLimit!==null?`; stickiness ≤ ${draft.stickinessLimit}`:""}</dd><dt>Fixed ingredients</dt><dd>{draft.ingredients.filter(i=>i.fixed).map(i=>i.name).join(", ")||"No fixed factors"}</dd><dt>Run status</dt><dd>{busy?"Waiting for real backend response":result?result.status:"Not executed"}</dd></dl>
        <button className="secondary" type="button" onClick={()=>void run("predict")}>{busy==="predict"?"Predicting…":"Predict baseline"}</button>
        {prediction&&<ResponseTable baseline={prediction.predicted_responses}/>}
        <button className="primary" type="button" onClick={()=>void run("optimize")}>{busy==="optimize"?"Searching candidates…":"Generate recommendations"}</button>
        <p className="small-note">Locking all factors or setting overly restrictive targets can return no candidates. Requests do not retrain the model.</p></>}
      {step===4&&result&&<ReformulationResults result={result} onValidate={openLabValidation}/>}
      {step===6&&result&&<><p>Evidence from the executed model result. Candidates are predicted estimates, not measured laboratory results.</p><dl className="review-list"><dt>Model</dt><dd>{result.model_version}</dd><dt>Data origin</dt><dd>{result.data_origin}</dd><dt>Product context</dt><dd>{result.product.brand} — {result.product.product_name} / {result.product.category_name}</dd><dt>Valid design</dt><dd>{result.product.factors.map(f=>`${f.label}: ${f.min}–${f.max}%`).join("; ")}</dd></dl>
        <ul>{result.limitations.map(note=><li key={note}>{note}</li>)}</ul>
        <details><summary>Session detail — raw engine request / response</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:11,maxHeight:450,overflow:"auto"}}>{JSON.stringify({request:executedRequest,response:result},null,2)}</pre></details>
        <p className="notice-note">A candidate ID is not a saved experiment ID. Locking a concentration does not prove efficacy is maintained.</p></>}
      {step===5&&result&&<><p>Select a candidate, save a validation plan and return later through Experimental Data. Actual results are recorded separately from model training.</p>
        <label htmlFor="lab-candidate">Candidate to validate</label><select id="lab-candidate" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{result.candidates.map(c=><option key={c.candidate_id} value={c.candidate_id}>#{c.rank} — {c.candidate_id}</option>)}</select>
        {selectedCandidate&&<CandidateValidation context={reformulationValidationContext(result, selectedCandidate, executedRequest, draft.insight.trim())} onOpenExperimental={onOpenExperimental}/>}
      </>}
      {busy&&<p role="status">{busy==="predict"?"Predicting baseline…":"Searching candidate formulations…"} Waiting for the engine response; per-stage progress is not streamed.</p>}
      {error&&<p className="rescue-error" role="alert">{error}</p>}
      <div className="wizard-actions"><button type="button" className="mode-toggle" disabled={step===0} onClick={()=>{setStep(step-1);setError("");}}>Back</button>{step<6&&<button type="submit" className="primary" disabled={(step===3&&!result)||(step===5&&!selectedCandidate)}>Continue →</button>}</div>
      </fieldset>
    </form><aside className="wizard-context"><span className="badge">R&D IN CONTROL</span><h2>Experiment brief</h2><p><strong>{draft.product||"No product selected"}</strong><br/>{draft.brand}{draft.category?` · ${draft.category}`:""}</p><h3>Improve</h3><p>{draft.direction} {draft.target}</p><h3>Preserve</h3><p>{draft.preserve||"Not specified"}</p><h3>Watch</h3><p>Hydration, stickiness and oiliness trade-offs within the supported model.</p><h3>Evidence boundary</h3><p>Synthetic profiles are not original product formulas. Recommendations still require laboratory validation.</p><p className="small-note">Knowledge updates and model retraining are separate reviewed processes, not automatic form-submission actions.</p></aside></div>
  </section>;
}
