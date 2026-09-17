"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import Library from "./library";
import FormulaRescue from "./formula-rescue";
import Reformulation from "./reformulation";
import type { NewSessionAnalysis, SessionAnalysis } from "../lib/session-analysis";

type View = "dashboard" | "rescue" | "reformulation" | "library";

function Mark() {
  return <span className="brand-mark" aria-hidden="true">S</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function Portal() {
  const [user, setUser] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [insightInput, setInsightInput] = useState("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [analyses, setAnalyses] = useState<SessionAnalysis[]>([]);

  const addAnalysis = useCallback((entry: NewSessionAnalysis) => {
    setAnalyses(current => [{ ...entry, id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()), createdAt: new Date().toISOString(), pinned: false }, ...current]);
  }, []);

  const visibleAnalyses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return analyses;
    return analyses.filter(item => [item.title, item.summary, item.insight, item.kind].some(value => value.toLocaleLowerCase().includes(query)));
  }, [analyses, search]);

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("username") ?? "").trim();
    if (!name) { setError("Isi nama pengguna terlebih dahulu."); return; }
    // The access form is local-only. Password values are intentionally never read, stored, logged, or sent.
    form.reset();
    setError("");
    setUser(name);
  }

  function togglePinned(id: string) {
    setAnalyses(current => current.map(item => item.id === id ? { ...item, pinned: !item.pinned } : item));
  }

  function AnalysisRow({ item, compact = false }: { item: SessionAnalysis; compact?: boolean }) {
    return <article className={`analysis-row ${compact ? "analysis-row-compact" : ""}`}>
      <span className="analysis-kind" aria-hidden="true">{item.kind === "rescue" ? "R" : "AI"}</span>
      <button className="analysis-link" onClick={() => setView(item.kind)}><strong>{item.title}</strong><span>{item.summary}</span></button>
      <div className="analysis-meta"><span className={`status-pill ${item.status === "Completed" ? "status-complete" : "status-empty"}`}>{item.status}</span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></div>
      <button className="pin-button" aria-label={item.pinned ? `Unpin ${item.title}` : `Pin ${item.title}`} aria-pressed={item.pinned} onClick={() => togglePinned(item.id)}>{item.pinned ? "★" : "☆"}</button>
    </article>;
  }

  if (!user) return <main className="login-layout">
    <section className="login-story">
      <div className="brand"><Mark /><span>SPONTAN<span className="brand-sub">FORMULATION WORKSPACE</span></span></div>
      <div className="story-copy"><p className="eyebrow">BUILT FOR CURIOUS R&amp;D TEAMS</p><h1>Better formulas.<br /><span>Thoughtful experiments.</span></h1><p>Satu workspace untuk menyelamatkan formula dan merancang eksperimen perbaikan berikutnya.</p><div className="story-tags"><span>Rescue</span><span>Reformulate</span><span>Validate</span></div></div>
      <p className="story-footer">Human expertise. AI-assisted exploration.</p>
    </section>
    <section className="login-panel"><div className="login-box"><h2>Welcome to your lab.</h2><p>Masuk untuk menjelajahi workspace formulasi.</p>
      <form onSubmit={login}><label htmlFor="username">Username</label><input id="username" name="username" required maxLength={40} autoComplete="username" /><label htmlFor="password">Password</label><input id="password" name="password" type="password" required maxLength={128} autoComplete="off" />{error && <p role="alert">{error}</p>}<button className="primary" type="submit">Masuk ke workspace <span aria-hidden="true">→</span></button></form>
      <p className="notice-note">Form ini hanya membuka sesi lokal pada browser. Kredensial belum diverifikasi atau disimpan; jangan gunakan password asli.</p>
    </div></section>
  </main>;

  return <div className="workspace">
    <aside id="workspace-nav" className={`sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <div className="sidebar-heading"><div className="brand"><Mark /><span>SPONTAN<span className="brand-sub">R&amp;D WORKSPACE</span></span></div><button className="sidebar-collapse" aria-label="Tutup navigasi" onClick={() => setSidebarOpen(false)}>‹</button></div>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Navigasi utama">{([['dashboard', '⌂', 'Dashboard'], ['reformulation', '△', 'New Analysis'], ['rescue', '◇', 'Formula Rescue'], ['library', '▤', 'Dataset Library']] as const).map(([key, icon, label]) => <button key={key} aria-current={view === key ? "page" : undefined} className={view === key ? "nav-active" : ""} onClick={() => setView(key)}><span><b aria-hidden="true">{icon}</b>{label}</span><span aria-hidden="true">›</span></button>)}</nav>
      <div className="sidebar-note"><p>Better Formulations<br />Brighter Possibilities</p></div>
    </aside>
    <div className="workspace-body">
      <header className="topbar"><button className="menu-toggle" aria-expanded={sidebarOpen} aria-controls="workspace-nav" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? "Hide menu" : "☰ Menu"}</button><span>Workspace / {view === "dashboard" ? "Dashboard" : view === "library" ? "Dataset Library" : view === "rescue" ? "Formula Rescue" : "New Analysis"}</span><div className="user-menu"><span className="avatar" aria-hidden="true">{user.charAt(0).toUpperCase()}</span><span>{user}</span><button onClick={() => { setUser(""); setView("dashboard"); setAnalyses([]); }}>Keluar</button></div></header>
      <main className="content">
        {view === "dashboard" ? <>
          <section className="dashboard-head"><div><p className="eyebrow">FORMULATION WORKSPACE</p><h1>Welcome back, {user}.</h1><p>What would you like to improve today?</p></div><label className="dashboard-search"><span aria-hidden="true">⌕</span><span className="sr-only">Search analyses, formulas, or ingredients</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search analyses, formulas, or ingredients…" /></label><aside className="notes-card"><div><h2>Notes</h2><span aria-hidden="true">•••</span></div><label className="sr-only" htmlFor="workspace-notes">Workspace notes</label><textarea id="workspace-notes" value={notes} maxLength={1200} onChange={event => setNotes(event.target.value)} placeholder="Add reminders, follow-ups, or lab tasks…" /></aside></section>
          <section className="dashboard-actions" aria-label="Start an analysis">
            <article className="action-card action-reformulation"><span className="action-icon" aria-hidden="true">△</span><div><p className="eyebrow">OPTIMIZE</p><h2>Start New Reformulation Analysis</h2><p>Select a product, define the validated insight, and search ranked adjustments.</p></div><button className="primary" onClick={() => setView("reformulation")}>New Analysis <span aria-hidden="true">→</span></button></article>
            <article className="action-card action-rescue"><span className="action-icon" aria-hidden="true">◇</span><div><p className="eyebrow">RECOVER</p><h2>Rescue Your Formulation</h2><p>Replace an unavailable ingredient using observed-stable historical formulas.</p></div><button className="secondary" onClick={() => setView("rescue")}>Start Rescue <span aria-hidden="true">→</span></button></article>
          </section>
          <section className="analysis-panel"><div className="panel-title"><h2><span aria-hidden="true">☆</span> Pinned Analysis</h2><span>{visibleAnalyses.filter(item => item.pinned).length}</span></div>{visibleAnalyses.some(item => item.pinned) ? <div className="analysis-list">{visibleAnalyses.filter(item => item.pinned).map(item => <AnalysisRow key={item.id} item={item} compact />)}</div> : <div className="panel-empty"><strong>No pinned analysis yet.</strong><p>Pin a completed session to keep it at the top of your workspace.</p></div>}</section>
          <section className="analysis-panel"><div className="panel-title"><h2><span aria-hidden="true">◷</span> Latest Analysis</h2><button onClick={() => setView("library")}>View all →</button></div>{visibleAnalyses.length ? <div className="analysis-list">{visibleAnalyses.slice(0, 5).map(item => <AnalysisRow key={item.id} item={item} />)}</div> : <div className="panel-empty"><strong>{search ? "No matching analysis." : "No analysis has been run in this session."}</strong><p>Successful API runs will appear here automatically.</p></div>}</section>
        </> : view === "library" ? <Library analyses={analyses} onUseInsight={text => { setInsightInput(text); setView("reformulation"); }} /> : view === "rescue" ? <FormulaRescue onAnalysis={addAnalysis} /> : <Reformulation initialInsight={insightInput} onAnalysis={addAnalysis} />}
        <footer className="disclaimer">Predicted / estimated and requires physical laboratory validation.</footer>
      </main>
    </div>
  </div>;
}
