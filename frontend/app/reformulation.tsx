"use client";
import { useState, type FormEvent } from "react";
import { initialDraft, validateStep, type ReformulationDraft } from "../lib/reformulation-draft";
const stages = ["Product", "Clean Insight", "Baseline", "Engine Review", "Recommendations", "Evidence", "Lab Validation"];
export default function Reformulation({ initialInsight = "" }: { initialInsight?: string }) {
  const [draft,setDraft]=useState(()=>initialDraft(initialInsight));
  const [step,setStep]=useState(0); const [furthest,setFurthest]=useState(0); const [error,setError]=useState("");
  const [lab,setLab]=useState({experiment:"",method:"",notes:"",status:"pending"});
  const [labMessage,setLabMessage]=useState("");
  function update<K extends keyof ReformulationDraft>(key: K, value: ReformulationDraft[K]) { setDraft(current=>({...current,[key]:value})); setFurthest(step); setError(""); }
  function next(event: FormEvent<HTMLFormElement>){
    event.preventDefault();
    // Revalidate previous steps when a user revisits and edits them.
    for(let index=0;index<=Math.min(step,2);index++){const message=validateStep(index,draft);if(message){setStep(index);setError(message);return;}}
    const target=Math.min(step+1,6);setError("");setStep(target);setFurthest(Math.max(furthest,target));
  }
  function exportLab(){
    if(!lab.experiment.trim()||!lab.method.trim()){setLabMessage("Isi experiment ID dan test method sebelum download draft.");return;}
    const record={record_kind:"lab_plan_draft",model_executed:false,candidate_id:null,measured_results:null,baseline:draft,lab_plan:lab,created_at_utc:new Date().toISOString()};
    const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="Spontan-lab-plan-DRAFT.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setLabMessage("Draft didownload. Belum disimpan ke backend/library dan bukan measured results.");
  }
  return <section className="reformulation-feature">
    <p className="eyebrow">CONSUMER-GUIDED EXPERIMENT DESIGN</p><h1>Improve what exists.<br/><span>Plan what comes next.</span></h1>
    <p>AI proposes, R&D decides, laboratory validates.</p>
    <p className="demo-note"><strong>FRONTEND PROTOTYPE</strong> — Alur tujuh tahap dapat dicoba. Model/optimizer belum terhubung; tidak ada prediksi atau eksperimen lab yang dijalankan. Draft hilang saat refresh/meninggalkan fitur.</p>
    <nav className="wizard-steps" aria-label="Tahap reformulation">{stages.map((title,index)=><button key={title} disabled={index>furthest} aria-current={step===index?"step":undefined} onClick={()=>{setStep(index);setError("");}}><span>0{index+1}</span>{title}</button>)}</nav>
    <div className="wizard-layout"><form className="wizard-panel" onSubmit={next}>
      <p className="eyebrow">STEP {step+1} / 7</p><h2>{stages[step]}</h2>
      {step===0&&<><p>Tentukan konteks produk dan baseline. Contoh generik, bukan formula brand nyata.</p>
        <label htmlFor="product-name">Product name</label><input id="product-name" required maxLength={100} value={draft.product} onChange={e=>update("product",e.target.value)}/>
        <div className="wizard-field-grid"><div><label htmlFor="product-category">Category</label><input id="product-category" required maxLength={80} value={draft.category} onChange={e=>update("category",e.target.value)}/></div><div><label htmlFor="formula-version">Formula version</label><input id="formula-version" required maxLength={40} value={draft.version} onChange={e=>update("version",e.target.value)}/></div></div>
        <div className="scope-note"><strong>Pilot context: Mercurio emulsion</strong><p>Kompatibilitas formula terhadap studi harus diverifikasi backend/evidence. Ini bukan model universal untuk semua moisturizer.</p></div></>}
      {step===1&&<><p>Feedback sudah dibersihkan oleh marketing. Pilih technical target secara manual; belum ada translator AI.</p>
        <label htmlFor="clean-insight">Clean insight</label><textarea id="clean-insight" required maxLength={2000} rows={4} value={draft.insight} onChange={e=>{update("insight",e.target.value);update("confirmed",false);}} placeholder="Contoh: terasa kurang melembapkan"/>
        {draft.insightOrigin==="library_demo"&&<span className="badge">INPUT DARI LIBRARY DEMO</span>}
        <div className="wizard-field-grid"><div><label htmlFor="technical-target">Improve</label><select id="technical-target" value={draft.target} onChange={e=>{update("target",e.target.value as "hydration"|"stickiness");update("confirmed",false);}}><option value="hydration">Hydration</option><option value="stickiness">Stickiness</option></select></div><div><label htmlFor="target-direction">Direction</label><select id="target-direction" value={draft.direction} onChange={e=>{update("direction",e.target.value as "increase"|"decrease");update("confirmed",false);}}><option value="increase">Increase</option><option value="decrease">Decrease</option></select></div></div>
        <label htmlFor="preserve-target">Preserve / constraints note</label><input id="preserve-target" maxLength={300} value={draft.preserve} onChange={e=>update("preserve",e.target.value)}/>
        <label className="checkbox-label"><input type="checkbox" checked={draft.confirmed} onChange={e=>update("confirmed",e.target.checked)}/>Saya mengonfirmasi target teknis sebagai R&D.</label></>}
      {step===2&&<><p>Identitas bahan tetap. Ini tabel tiga faktor studi, <strong>bukan formulasi lengkap</strong>; base/water mass balance belum ditentukan.</p>
        <div className="trace-table-wrap"><table className="wizard-table"><caption>Baseline concentration dan batas perubahan (UI draft)</caption><thead><tr><th>Ingredient</th><th>Current %</th><th>Fixed</th><th>Min %</th><th>Max %</th></tr></thead><tbody>{draft.ingredients.map((item,index)=><tr key={item.name}><th scope="row">{item.name}</th><td><input aria-label={item.name+" concentration"} type="number" required min="0" max="100" step="0.01" value={Number.isNaN(item.concentration)?"":item.concentration} onChange={e=>update("ingredients",draft.ingredients.map((row,i)=>i===index?{...row,concentration:e.target.valueAsNumber}:row))}/></td><td><input aria-label={"Fixed "+item.name} type="checkbox" checked={item.fixed} onChange={e=>update("ingredients",draft.ingredients.map((row,i)=>i===index?{...row,fixed:e.target.checked}:row))}/></td>{(["min","max"] as const).map(key=><td key={key}><input aria-label={item.name+" "+key} type="number" required disabled={item.fixed} min="0" max="100" step="0.01" value={Number.isNaN(item[key])?"":item[key]} onChange={e=>update("ingredients",draft.ingredients.map((row,i)=>i===index?{...row,[key]:e.target.valueAsNumber}:row))}/></td>)}</tr>)}</tbody></table></div>
        <h3>Process baseline / context only</h3><p>Mercurio pilot tidak memodelkan perubahan proses. Parameter berikut dicatat sebagai konteks, bukan optimizer knobs aktif.</p>
        <div className="wizard-field-grid">{([["temperature","Temperature (°C)"],["speed","Mixing speed (rpm)"],["duration","Mixing duration (min)"]] as const).map(([key,label])=><div key={key}><label htmlFor={"process-"+key}>{label}</label><input id={"process-"+key} type="number" required min={key==="temperature"?0:0.01} max={key==="temperature"?150:undefined} step="0.01" value={Number.isNaN(draft[key])?"":draft[key]} onChange={e=>update(key,e.target.valueAsNumber)}/></div>)}</div></>}
      {step===3&&<><p>Review input sebelum model dihubungkan. Tidak ada feature extraction atau inference yang sedang dijalankan.</p><dl className="review-list"><dt>Product / version</dt><dd>{draft.product} / {draft.version}</dd><dt>Technical objective</dt><dd>{draft.direction} {draft.target}</dd><dt>Fixed ingredients</dt><dd>{draft.ingredients.filter(i=>i.fixed).map(i=>i.name).join(", ")||"Tidak ada fixed factor"}</dd><dt>Run status</dt><dd>Not executed — model/optimizer unavailable</dd></dl>
        <button className="secondary" type="button" disabled>Generate recommendations — belum tersedia</button><p className="small-note">Tombol Lanjut hanya membuka preview halaman berikutnya, bukan menjalankan AI.</p></>}
      {step===4&&<><p>Area Top 3 akan menampilkan perubahan, predicted responses, trade-off, dan evidence dari API nyata.</p><div className="recommendation-slots">{["Candidate A","Candidate B","Candidate C"].map(name=><article key={name}><span className="badge muted">BELUM ADA HASIL</span><h3>{name}</h3><p>Tidak ada kandidat/prediksi. Menunggu model dan optimizer.</p></article>)}</div>
        <div className="scope-note"><strong>Not evaluated</strong><p>Cost, sustainability, safety, brightening, dan stability belum didukung oleh model pilot sensory. Tidak menampilkan angka +15% atau klaim performance/cost/sustainability palsu.</p></div></>}
      {step===5&&<><p>Setiap hasil nanti harus menjelaskan apa yang berubah, alasan, dan sumber yang mendukung.</p><div className="trace-table-wrap"><table className="wizard-table"><thead><tr><th>Evidence field</th><th>Status</th></tr></thead><tbody>{["Candidate changes","Predicted responses / units","Source relation / study","Model version","Data origin / measured vs generated","Valid design range"].map(name=><tr key={name}><th scope="row">{name}</th><td>Belum ada candidate response</td></tr>)}</tbody></table></div><p className="demo-note">Data literature-derived bukan eksperimen baru. Mengunci active concentration tidak membuktikan efficacy dipertahankan.</p></>}
      {step===6&&<><p>Susun rencana lab. Belum ada candidate ID, measured results, atau penyimpanan permanen; bukan validation yang sudah selesai.</p>
        <label htmlFor="experiment-id">Experiment ID (draft)</label><input id="experiment-id" maxLength={80} value={lab.experiment} onChange={e=>{setLab({...lab,experiment:e.target.value});setLabMessage("");}}/>
        <label htmlFor="test-method">Test method / instrument (draft)</label><input id="test-method" maxLength={200} value={lab.method} onChange={e=>{setLab({...lab,method:e.target.value});setLabMessage("");}}/>
        <label htmlFor="lab-notes">Tests to plan / notes</label><textarea id="lab-notes" rows={3} maxLength={2000} value={lab.notes} onChange={e=>setLab({...lab,notes:e.target.value})}/>
        <label htmlFor="lab-status">Validation status</label><select id="lab-status" disabled value={lab.status}><option value="pending">Pending — belum diuji</option></select>
        <button type="button" className="secondary" onClick={exportLab}>Download lab-plan draft JSON</button><p role="status">{labMessage}</p><button type="button" className="secondary" disabled>Save measured results — perlu backend dan data lab</button></>}
      {error&&<p className="rescue-error" role="alert">{error}</p>}
      <div className="wizard-actions"><button type="button" className="mode-toggle" disabled={step===0} onClick={()=>{setStep(step-1);setError("");}}>Kembali</button>{step<6&&<button type="submit" className="primary">{step>=3?"Lanjut preview":"Lanjut"} →</button>}</div>
    </form><aside className="wizard-context"><span className="badge">R&D IN CONTROL</span><h2>Experiment brief</h2><p><strong>{draft.product||"Belum ada produk"}</strong><br/>{draft.version}</p><h3>Improve</h3><p>{draft.direction} {draft.target}</p><h3>Preserve</h3><p>{draft.preserve||"Belum ditetapkan"}</p><h3>Watch</h3><p>Hydration / stickiness / oiliness trade-off sesuai supported model.</p><h3>Evidence boundary</h3><p>Target tidak didukung → not evaluated. Rekomendasi tetap harus diuji lab.</p><p className="small-note">Knowledge update dan retraining merupakan tahap terpisah, bukan otomatis setelah mengisi form.</p></aside></div>
  </section>;
}
