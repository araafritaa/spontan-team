"use client";

import { useState, type FormEvent } from "react";
import Library from "./library";
import FormulaRescue from "./formula-rescue";
import Reformulation from "./reformulation";

type View = "dashboard" | "rescue" | "reformulation" | "library";

function Mark() {
  return <span className="brand-mark" aria-hidden="true">S</span>;
}

export default function Portal() {
  const [user, setUser] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [insightInput, setInsightInput] = useState("");

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("username") ?? "").trim();
    if (!name) { setError("Isi nama pengguna terlebih dahulu."); return; }
    // Password is intentionally never read, stored, logged, or sent anywhere.
    form.reset();
    setError("");
    setUser(name);
  }

  if (!user) return <main className="login-layout">
    <section className="login-story">
      <div className="brand"><Mark /><span>SPONTAN<span className="brand-sub">FORMULATION WORKSPACE</span></span></div>
      <div className="story-copy"><p className="eyebrow">BUILT FOR CURIOUS R&D TEAMS</p>
        <h1>Better formulas.<br /><span>Thoughtful experiments.</span></h1>
        <p>Satu workspace untuk menyelamatkan formula dan merancang eksperimen perbaikan berikutnya.</p>
        <div className="story-tags"><span>01 / Rescue</span><span>02 / Reformulate</span><span>03 / Validate</span></div>
      </div>
      <p className="story-footer">Human expertise. AI-assisted exploration.</p>
    </section>
    <section className="login-panel"><div className="login-box">
      <span className="badge">PROTOTYPE / DEMO</span><h2>Welcome to your lab.</h2>
      <p>Masuk untuk menjelajahi workspace formulasi.</p>
      <form onSubmit={login}>
        <label htmlFor="username">Username</label>
        <input id="username" name="username" placeholder="Contoh: ara" required maxLength={40} autoComplete="off" />
        <label htmlFor="password">Password demo</label>
        <input id="password" name="password" type="password" placeholder="Isi teks dummy, bukan password asli" required maxLength={128} autoComplete="off" />
        {error && <p role="alert">{error}</p>}
        <button className="primary" type="submit">Masuk ke workspace <span aria-hidden="true">→</span></button>
      </form>
      <p className="demo-note">Login demo: semua username dan password dummy diterima. Tidak ada verifikasi akun, penyimpanan password, atau perlindungan akses. Refresh akan mengakhiri sesi demo.</p>
    </div></section>
  </main>;

  return <div className="workspace">
    <aside id="workspace-nav" className={`sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}><button className="back" onClick={() => setSidebarOpen(false)}>Tutup menu</button><div className="brand"><Mark /><span>SPONTAN<span className="brand-sub">R&D WORKSPACE</span></span></div>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Navigasi utama">
        {([['dashboard', 'Dashboard'], ['library', 'Dataset Library'], ['rescue', 'Formula Rescue'], ['reformulation', 'AI Reformulation']] as const).map(([key, label]) =>
          <button key={key} aria-current={view === key ? "page" : undefined} className={view === key ? "nav-active" : ""} onClick={() => setView(key)}>{label}<span aria-hidden="true">↗</span></button>)}
      </nav>
      <div className="sidebar-note"><span className="badge">DEMO WORKSPACE</span><p>Eksplorasi dimulai di sini. Keputusan akhir tetap di laboratorium.</p></div>
    </aside>
    <div className="workspace-body"><header className="topbar"><button className="menu-toggle" aria-expanded={sidebarOpen} aria-controls="workspace-nav" onClick={() => setSidebarOpen(!sidebarOpen)}>Menu</button><span>Workspace / {view === "dashboard" ? "Overview" : view === "library" ? "Dataset Library" : view === "rescue" ? "Formula Rescue" : "AI Reformulation"}</span>
      <div className="user-menu"><span className="avatar" aria-hidden="true">{user.charAt(0).toUpperCase()}</span><span>{user}</span><button onClick={() => { setUser(""); setView("dashboard"); }}>Keluar</button></div>
    </header>
    <main className="content">
      {view === "dashboard" ? <>
        <section className="welcome"><p className="eyebrow">YOUR FORMULATION TOOLKIT</p><h1>Halo, {user}.<br /><span>What will we improve today?</span></h1><p>Pilih alur kerja sesuai tantangan formulasi timmu.</p></section>
        <section className="feature-grid dashboard-grid" aria-label="Fitur workspace">
          <article className="feature-card"><div className="card-top"><span className="feature-icon" aria-hidden="true">01</span><span className="badge">API INTEGRATED</span></div>
            <h2>Formula Rescue</h2><p>Bahan tidak tersedia? Temukan kandidat historis dengan perubahan minimal dan perkiraan stabilitas.</p>
            <ul><li>Pilih formula awal</li><li>Tentukan bahan yang tidak tersedia</li><li>Tinjau Top 3 kandidat rescue</li></ul>
            <button className="primary" onClick={() => setView("rescue")}>Lihat fitur <span aria-hidden="true">→</span></button>
          </article>
          <article className="feature-card"><div className="card-top"><span className="feature-icon" aria-hidden="true">02</span><span className="badge muted">DALAM PENGEMBANGAN</span></div>
            <h2>AI Reformulation</h2><p>Ubah insight konsumen menjadi arah eksperimen: optimalkan konsentrasi bahan dalam sistem yang didukung.</p>
            <ul><li>Masukkan insight dan formula saat ini</li><li>Tentukan target dan batas perubahan</li><li>Validasi rekomendasi melalui eksperimen lab</li></ul>
            <button className="secondary" onClick={() => setView("reformulation")}>Mulai experiment draft <span aria-hidden="true">→</span></button>
          </article>
          <article className="feature-card"><div className="card-top"><span className="feature-icon" aria-hidden="true">03</span><span className="badge muted">DEMO LIBRARY</span></div>
            <h2>Dataset Library</h2><p>Jelajahi clean insight, riwayat sesi contoh, dan detail evidence dalam satu tempat.</p>
            <ul><li>Insight sebagai input reformulation</li><li>Simple Mode dan Session Detail</li><li>Download CSV / JSON</li></ul>
            <button className="secondary" onClick={() => setView("library")}>Buka library <span aria-hidden="true">→</span></button>
          </article>
        </section>
        <section className="workflow"><p className="eyebrow">HOW WE WORK</p><div><span>01 / Define the challenge</span><span>02 / Explore candidates</span><span>03 / Validate in the lab</span></div><p>Formula Rescue memakai API nyata. AI Reformulation dan riwayat library masih dalam tahap pengembangan/demo.</p></section>
      </> : view === "library" ? <Library onUseInsight={text => { setInsightInput(text); setView("reformulation"); }} /> : view === "rescue" ? <FormulaRescue /> : <Reformulation initialInsight={insightInput} />}
      <footer className="disclaimer">Predicted / estimated and requires physical laboratory validation.</footer>
    </main></div>
  </div>;
}
