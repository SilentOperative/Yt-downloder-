import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, ExternalLink, History, Link2, Loader2, Moon, Play, RefreshCw, Settings2, Sun, Terminal, Trash2, X } from 'lucide-react';
import './styles.css';

const DEFAULT_API = import.meta.env.VITE_LOCAL_API_URL || '';
const HISTORY_KEY = 'yt-forge-web-history';
const THEME_KEY = 'yt-forge-web-theme';
const FALLBACK_QUALITIES = [2160, 1440, 1080, 720, 480, 360];

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

function qualityNumber(format) {
  const match = String(format?.resolution || '').match(/(\d{3,4})p/i);
  return match ? Number(match[1]) : Number(format?.height) || 0;
}

function estimateDownloadSize(media, selectedFormat, selectedQuality) {
  const formats = Array.isArray(media?.formats) ? media.formats : [];
  const sized = formats.filter((item) => Number(item.filesize) > 0);
  if (!sized.length) return 0;
  const audio = sized.filter((item) => item.vcodec === 'none' || item.resolution === 'audio');
  if (selectedFormat === 'mp3' || selectedFormat === 'm4a') return Math.max(...audio.map((item) => Number(item.filesize)), 0);
  const videos = sized.filter((item) => item.vcodec && item.vcodec !== 'none');
  const maxHeight = selectedQuality === 'best' ? Infinity : Number(selectedQuality);
  const matchingVideo = videos.filter((item) => qualityNumber(item) <= maxHeight);
  const videoSize = Math.max(...(matchingVideo.length ? matchingVideo : videos).map((item) => Number(item.filesize)), 0);
  const audioSize = Math.max(...audio.map((item) => Number(item.filesize)), 0);
  return videoSize + audioSize;
}

function formatBytes(value) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Calculating…';
  const rounded = Math.ceil(seconds);
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return minutes ? `${minutes}m ${String(remaining).padStart(2, '0')}s remaining` : `${remaining}s remaining`;
}

function App() {
  const [apiBase, setApiBase] = useState(() => localStorage.getItem('yt-forge-web-api') || DEFAULT_API);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('Drop a link. Keep the file local.');
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('best');
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'));
  const [showSettings, setShowSettings] = useState(false);
  const [engineStatus, setEngineStatus] = useState('checking');
  const [transfer, setTransfer] = useState(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme); }, [theme]);
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }, [history]);
  useEffect(() => {
    fetch(apiUrl(apiBase, '/api/health')).then((r) => r.json()).then((v) => setEngineStatus(v.engine === 'yt-dlp-ready' ? 'ready' : 'missing')).catch(() => setEngineStatus('offline'));
  }, [apiBase]);

  const selectedUrl = useMemo(() => info?.webpage_url || url, [info, url]);
  const isBusy = status === 'loading' || status === 'downloading';
  const qualityOptions = useMemo(() => {
    const values = [...new Set((info?.formats || []).map(qualityNumber).filter((height) => height >= 240))].sort((a, b) => b - a);
    return values.length ? values : FALLBACK_QUALITIES;
  }, [info]);

  async function inspect(event) {
    event?.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) return setMessage('Enter a complete http(s) link.');
    setStatus('loading'); setInfo(null); setQuality('best'); setMessage('Reading media details through the local engine…');
    try {
      const response = await fetch(apiUrl(apiBase, '/api/info', { url: url.trim() }));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Metadata lookup failed.');
      setInfo(data); setStatus('ready'); setMessage(data.kind === 'playlist' ? `${data.playlist_count} playlist entries found.` : 'Ready to download locally.');
    } catch (error) { setStatus('error'); setMessage(error.message); }
  }

  async function download(targetUrl = selectedUrl, title = info?.title || 'download') {
    if (!targetUrl || status === 'downloading') return;
    setStatus('downloading');
    setMessage('Preparing a browser download from the local engine…');
    setTransfer({ received: 0, total: 0, speed: 0, eta: null, estimated: false });
    const startedAt = performance.now();
    try {
      const response = await fetch(apiUrl(apiBase, '/api/download', { url: targetUrl, format, quality }));
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Download failed with HTTP ${response.status}.`);
      }
      const headerTotal = Number(response.headers.get('content-length')) || 0;
      const estimatedTotal = estimateDownloadSize(info, format, quality);
      const total = headerTotal || estimatedTotal;
      const reader = response.body?.getReader();
      const chunks = [];
      let received = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.byteLength;
          const elapsed = Math.max((performance.now() - startedAt) / 1000, 0.1);
          const speed = received / elapsed;
          setTransfer({ received, total, estimated: !headerTotal && Boolean(estimatedTotal), speed, eta: total && speed ? Math.max(0, (total - received) / speed) : null });
        }
      } else {
        const buffer = await response.arrayBuffer();
        chunks.push(new Uint8Array(buffer));
        received = buffer.byteLength;
        setTransfer({ received, total: total || received, estimated: !headerTotal && Boolean(estimatedTotal), speed: received / Math.max((performance.now() - startedAt) / 1000, 0.1), eta: 0 });
      }
      const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${String(title || 'yt-forge-download').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 100) || 'yt-forge-download'}.${format === 'best' ? 'mp4' : format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      const item = { id: `${Date.now()}-${targetUrl}`, title, url: targetUrl, format, quality, createdAt: new Date().toISOString(), status: 'completed' };
      setHistory((current) => [item, ...current].slice(0, 50));
      setTransfer((current) => ({ ...(current || {}), received, total: total || received, eta: 0, complete: true }));
      setStatus('ready');
      setMessage('Download complete. Check your Downloads folder.');
    } catch (error) {
      setStatus('error');
      setTransfer(null);
      setMessage(error.message);
    }
  }

  function clearCurrent() { setInfo(null); setUrl(''); setQuality('best'); setTransfer(null); setStatus('idle'); setMessage('Drop a link. Keep the file local.'); }

  return <div className="app-shell">
    <div className="phone-block"><Terminal size={22} /><strong>YT-FORGE works best on a larger screen</strong><span>The same controls are available on mobile; rotate your device or continue with the compact layout.</span></div>
    <aside className="rail">
      <div className="brand"><div className="brand-mark">YF</div><div><strong>YT-FORGE</strong><span>WEB WORKSTATION</span></div></div>
      <div className="signal-line" />
      <div className="rail-section"><span className="eyebrow">WORKFLOW</span><div className="rail-item active"><Play size={15} /> Intake & download</div><div className="rail-item" onClick={() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' })}><History size={15} /> Local history <b>{history.length}</b></div></div>
      <div className="rail-bottom"><div className={`engine-dot ${engineStatus}`} /><div><span className="eyebrow">LOCAL ENGINE</span><strong>{engineStatus === 'ready' ? 'yt-dlp ready' : engineStatus}</strong></div><button className="icon-button" onClick={() => setShowSettings(true)} title="Settings"><Settings2 size={16} /></button></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div><span className="eyebrow">DESKTOP + MOBILE WEB</span><h1>Local media intake</h1></div><div className="top-actions"><span className="status-pill"><span className={`status-dot ${engineStatus}`} /> {engineStatus === 'ready' ? 'Engine ready' : 'Connect engine'}</span><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button></div></header>
      <section className="hero-panel"><div className="hero-copy"><span className="eyebrow">01 / SOURCE LINK</span><h2>Bring the media<br /><em>home.</em></h2><p>The browser is the control surface. Choose video quality or audio format before the local engine starts.</p></div><div className="intake-card"><form onSubmit={inspect}><label htmlFor="url">MEDIA URL</label><div className="url-row"><Link2 size={18} /><input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" disabled={isBusy} /><button className="inspect-button" disabled={isBusy || !url.trim()}>{isBusy ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />} Inspect</button></div></form><div className="intake-foot"><span><span className={`status-dot ${engineStatus}`} /> {engineStatus === 'ready' ? 'Download engine connected' : 'Start the engine to begin'}</span><span className="mono">HTTP / yt-dlp</span></div></div></section>
      {status === 'error' && <div className="alert error"><X size={16} /> {message}</div>}
      {status !== 'error' && status !== 'idle' && !info && <div className="alert"><Loader2 className="spin" size={16} /> {message}</div>}
      {transfer && <div className="transfer-panel"><div className="transfer-heading"><div><span className="eyebrow">TRANSFER STATUS</span><strong>{transfer.complete ? 'Download complete' : 'Downloading through browser'}</strong></div><span className="mono">{transfer.total ? `${Math.round(Math.min(100, (transfer.received / transfer.total) * 100))}%` : 'LIVE'}</span></div><div className="progress-track"><div className={`progress-fill ${transfer.total ? '' : 'indeterminate'}`} style={{ width: transfer.total ? `${Math.min(100, (transfer.received / transfer.total) * 100)}%` : '38%' }} /></div><div className="transfer-meta"><span>{formatBytes(transfer.received)}{transfer.total ? ` / ${transfer.estimated ? '≈' : ''}${formatBytes(transfer.total)}` : ''}</span><span>{transfer.speed ? `${formatBytes(transfer.speed)}/s` : 'Starting…'}</span><span>{transfer.complete ? 'Saved to Downloads' : formatEta(transfer.eta)}</span></div></div>}
      {info && <section className="result-panel"><div className="section-heading"><div><span className="eyebrow">02 / MEDIA DETAILS</span><h3>{info.kind === 'playlist' ? 'Playlist ready' : 'Source ready'}</h3></div><button className="text-button" onClick={clearCurrent}>Clear <X size={14} /></button></div><div className="media-summary"><div className="thumb-wrap">{info.thumbnail ? <img src={info.thumbnail} alt="" /> : <div className="thumb-empty"><Download size={22} /></div>}</div><div className="media-copy"><h4>{info.title}</h4><p>{info.uploader || 'Unknown channel'} <span>•</span> {info.kind === 'playlist' ? `${info.playlist_count} entries` : formatDuration(info.duration)}</p><span className="mono url-truncate">{info.webpage_url}</span></div><div className="download-controls"><label>VIDEO QUALITY</label><select value={quality} onChange={(e) => setQuality(e.target.value)} disabled={format === 'mp3' || format === 'm4a'}><option value="best">Best available</option>{qualityOptions.map((height) => <option value={String(height)} key={height}>Up to {height}p</option>)}</select><label>AUDIO / VIDEO FORMAT</label><select value={format} onChange={(e) => setFormat(e.target.value)}><option value="mp4">MP4 video</option><option value="best">Best available</option><option value="mp3">MP3 audio</option><option value="m4a">M4A audio</option></select><button className="primary-button" onClick={() => download()}><Download size={17} /> Download {info.kind === 'playlist' ? 'source' : 'file'}</button></div></div>{info.kind === 'playlist' && <div className="playlist-list"><div className="list-label">PLAYLIST ITEMS</div>{info.entries.slice(0, 50).map((entry) => <div className="playlist-row" key={entry.index}><span className="index">{String(entry.index).padStart(2, '0')}</span><div className="playlist-title"><strong>{entry.title}</strong><span>{formatDuration(entry.duration)}</span></div><button className="row-download" onClick={() => download(entry.webpage_url, entry.title)}><Download size={15} /></button></div>)}</div>}</section>}
      <section className="history-panel" id="history"><div className="section-heading"><div><span className="eyebrow">03 / LOCAL HISTORY</span><h3>Recent transfers</h3></div>{history.length > 0 && <button className="text-button" onClick={() => setHistory([])}><Trash2 size={14} /> Clear all</button>}</div>{history.length === 0 ? <div className="empty-history"><History size={21} /><span>No local downloads yet.</span><small>Completed browser downloads will be recorded here.</small></div> : <div className="history-list">{history.map((item) => <div className="history-row" key={item.id}><div className="history-icon"><Download size={15} /></div><div className="history-title"><strong>{item.title}</strong><span>{item.format.toUpperCase()} {item.quality && item.quality !== 'best' ? `• ${item.quality}p` : ''} <i>•</i> {new Date(item.createdAt).toLocaleString()}</span></div><a href={apiUrl(apiBase, '/api/download', { url: item.url, format: item.format, quality: item.quality || 'best' })} className="row-download" title="Download again"><ExternalLink size={15} /></a></div>)}</div>}</section>
      <footer><span>YT-FORGE WEB / LOCAL-FIRST CONTROL SURFACE</span><span>Only download media you have permission to access.</span></footer>
    </main>
    {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}><div className="settings-modal" onClick={(e) => e.stopPropagation()}><div className="section-heading"><div><span className="eyebrow">SYSTEM SETTINGS</span><h3>Engine connection</h3></div><button className="icon-button" onClick={() => setShowSettings(false)}><X size={17} /></button></div><label>LOCAL ENGINE URL</label><input className="settings-input mono" value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="http://localhost:8787" /><p className="settings-note">Run <code>npm run dev</code> from the repository root for local mode. A Vercel deployment uses its serverless `/api` backend on desktop and mobile.</p><button className="primary-button full" onClick={() => { localStorage.setItem('yt-forge-web-api', apiBase); setShowSettings(false); }}>Save connection</button></div></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
