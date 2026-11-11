import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, ExternalLink, History, Link2, Loader2, Moon, Play, RefreshCw, Settings2, Sun, Terminal, Trash2, X } from 'lucide-react';
import './styles.css';

const DEFAULT_API = import.meta.env.VITE_LOCAL_API_URL || '';
const HISTORY_KEY = 'yt-forge-web-history';
const THEME_KEY = 'yt-forge-web-theme';

function formatDuration(value) {
  if (!value) return 'Unknown duration';
  const seconds = Number(value);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function apiUrl(base, path, params = {}) {
  const root = base.replace(/\/$/, '');
  const query = new URLSearchParams(params).toString();
  return `${root}${path}${query ? `?${query}` : ''}`;
}

function App() {
  const [apiBase, setApiBase] = useState(() => localStorage.getItem('yt-forge-web-api') || DEFAULT_API);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('Drop a link. Keep the file local.');
  const [format, setFormat] = useState('mp4');
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'));
  const [showSettings, setShowSettings] = useState(false);
  const [engineStatus, setEngineStatus] = useState('checking');

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme); }, [theme]);
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }, [history]);
  useEffect(() => {
    fetch(apiUrl(apiBase, '/api/health')).then((r) => r.json()).then((v) => setEngineStatus(v.engine === 'yt-dlp-ready' ? 'ready' : 'missing')).catch(() => setEngineStatus('offline'));
  }, [apiBase]);

  const selectedUrl = useMemo(() => info?.webpage_url || url, [info, url]);
  const isBusy = status === 'loading' || status === 'downloading';

  async function inspect(event) {
    event?.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) return setMessage('Enter a complete http(s) link.');
    setStatus('loading'); setInfo(null); setMessage('Reading media details through the local engine…');
    try {
      const response = await fetch(apiUrl(apiBase, '/api/info', { url: url.trim() }));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Metadata lookup failed.');
      setInfo(data); setStatus('ready'); setMessage(data.kind === 'playlist' ? `${data.playlist_count} playlist entries found.` : 'Ready to download locally.');
    } catch (error) { setStatus('error'); setMessage(error.message); }
  }

  function download(targetUrl = selectedUrl, title = info?.title || 'download') {
    if (!targetUrl) return;
    setStatus('downloading'); setMessage('Preparing a browser download from the local engine…');
    const item = { id: `${Date.now()}-${targetUrl}`, title, url: targetUrl, format, createdAt: new Date().toISOString(), status: 'started' };
    setHistory((current) => [item, ...current].slice(0, 50));
    window.location.href = apiUrl(apiBase, '/api/download', { url: targetUrl, format });
    window.setTimeout(() => { setStatus('ready'); setMessage('Download sent to the browser. Check your Downloads folder.'); }, 900);
  }

  function clearCurrent() { setInfo(null); setUrl(''); setStatus('idle'); setMessage('Drop a link. Keep the file local.'); }

  return <div className="app-shell">
    <div className="phone-block"><Terminal size={22} /><strong>Desktop browser required</strong><span>YT-FORGE Web is intentionally built for desktop browsers on Windows, Linux, and macOS.</span></div>
    <aside className="rail">
      <div className="brand"><div className="brand-mark">YF</div><div><strong>YT-FORGE</strong><span>WEB WORKSTATION</span></div></div>
      <div className="signal-line" />
      <div className="rail-section"><span className="eyebrow">WORKFLOW</span><div className="rail-item active"><Play size={15} /> Intake & download</div><div className="rail-item" onClick={() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' })}><History size={15} /> Local history <b>{history.length}</b></div></div>
      <div className="rail-bottom"><div className={`engine-dot ${engineStatus}`} /><div><span className="eyebrow">LOCAL ENGINE</span><strong>{engineStatus === 'ready' ? 'yt-dlp ready' : engineStatus}</strong></div><button className="icon-button" onClick={() => setShowSettings(true)} title="Settings"><Settings2 size={16} /></button></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div><span className="eyebrow">DESKTOP BROWSER EDITION</span><h1>Local media intake</h1></div><div className="top-actions"><span className="status-pill"><span className={`status-dot ${engineStatus}`} /> {engineStatus === 'ready' ? 'Local mode' : 'Connect local engine'}</span><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button></div></header>
      <section className="hero-panel"><div className="hero-copy"><span className="eyebrow">01 / SOURCE LINK</span><h2>Bring the media<br /><em>home.</em></h2><p>The browser is only the control surface. Your local yt-dlp engine does the work on your computer.</p></div><div className="intake-card"><form onSubmit={inspect}><label htmlFor="url">MEDIA URL</label><div className="url-row"><Link2 size={18} /><input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" disabled={isBusy} /><button className="inspect-button" disabled={isBusy || !url.trim()}>{isBusy ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />} Inspect</button></div></form><div className="intake-foot"><span><span className={`status-dot ${engineStatus}`} /> {engineStatus === 'ready' ? 'Local engine connected' : 'Start the local engine to begin'}</span><span className="mono">HTTP / yt-dlp</span></div></div></section>
      {status === 'error' && <div className="alert error"><X size={16} /> {message}</div>}
      {status !== 'error' && status !== 'idle' && !info && <div className="alert"><Loader2 className="spin" size={16} /> {message}</div>}
      {info && <section className="result-panel"><div className="section-heading"><div><span className="eyebrow">02 / MEDIA DETAILS</span><h3>{info.kind === 'playlist' ? 'Playlist ready' : 'Source ready'}</h3></div><button className="text-button" onClick={clearCurrent}>Clear <X size={14} /></button></div><div className="media-summary"><div className="thumb-wrap">{info.thumbnail ? <img src={info.thumbnail} alt="" /> : <div className="thumb-empty"><Download size={22} /></div>}</div><div className="media-copy"><h4>{info.title}</h4><p>{info.uploader || 'Unknown channel'} <span>•</span> {info.kind === 'playlist' ? `${info.playlist_count} entries` : formatDuration(info.duration)}</p><span className="mono url-truncate">{info.webpage_url}</span></div><div className="download-controls"><label>OUTPUT</label><select value={format} onChange={(e) => setFormat(e.target.value)}><option value="mp4">MP4 video</option><option value="best">Best available</option><option value="mp3">MP3 audio</option><option value="m4a">M4A audio</option></select><button className="primary-button" onClick={() => download()}><Download size={17} /> Download {info.kind === 'playlist' ? 'source' : 'file'}</button></div></div>{info.kind === 'playlist' && <div className="playlist-list"><div className="list-label">PLAYLIST ITEMS</div>{info.entries.slice(0, 50).map((entry) => <div className="playlist-row" key={entry.index}><span className="index">{String(entry.index).padStart(2, '0')}</span><div className="playlist-title"><strong>{entry.title}</strong><span>{formatDuration(entry.duration)}</span></div><button className="row-download" onClick={() => download(entry.webpage_url, entry.title)}><Download size={15} /></button></div>)}</div>}</section>}
      <section className="history-panel" id="history"><div className="section-heading"><div><span className="eyebrow">03 / LOCAL HISTORY</span><h3>Recent transfers</h3></div>{history.length > 0 && <button className="text-button" onClick={() => setHistory([])}><Trash2 size={14} /> Clear all</button>}</div>{history.length === 0 ? <div className="empty-history"><History size={21} /><span>No local downloads yet.</span><small>Completed browser downloads will be recorded here.</small></div> : <div className="history-list">{history.map((item) => <div className="history-row" key={item.id}><div className="history-icon"><Download size={15} /></div><div className="history-title"><strong>{item.title}</strong><span>{item.format.toUpperCase()} <i>•</i> {new Date(item.createdAt).toLocaleString()}</span></div><a href={apiUrl(apiBase, '/api/download', { url: item.url, format: item.format })} className="row-download" title="Download again"><ExternalLink size={15} /></a></div>)}</div>}</section>
      <footer><span>YT-FORGE WEB / LOCAL-FIRST CONTROL SURFACE</span><span>Only download media you have permission to access.</span></footer>
    </main>
    {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}><div className="settings-modal" onClick={(e) => e.stopPropagation()}><div className="section-heading"><div><span className="eyebrow">SYSTEM SETTINGS</span><h3>Local connection</h3></div><button className="icon-button" onClick={() => setShowSettings(false)}><X size={17} /></button></div><label>LOCAL ENGINE URL</label><input className="settings-input mono" value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="http://localhost:8787" /><p className="settings-note">Run <code>npm run dev</code> inside the <code>web</code> directory to start the browser and local yt-dlp engine together. A Vercel deployment hosts the interface; downloads still require this local engine.</p><button className="primary-button full" onClick={() => { localStorage.setItem('yt-forge-web-api', apiBase); setShowSettings(false); }}>Save connection</button></div></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
