import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');
const port = Number(process.env.PORT || 8787);

function binaryPath() {
  const platform = process.platform;
  if (platform === 'win32') return join(projectRoot, 'bin', 'yt-dlp.exe');
  if (platform === 'darwin') return join(projectRoot, 'bin', 'yt-dlp_macos');
  const arm = process.arch === 'arm64';
  return join(projectRoot, 'bin', arm ? 'yt-dlp_linux_arm64' : 'yt-dlp_linux_x64');
}

function validUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function runYtDlp(args, { jsonOutput = false } = {}) {
  return new Promise((resolve, reject) => {
    const binary = binaryPath();
    if (!existsSync(binary)) return reject(new Error(`yt-dlp binary not found at ${binary}`));
    const child = spawn(binary, ['--no-warnings', '--ignore-config', ...args], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      if (!jsonOutput) return resolve(stdout);
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('yt-dlp returned invalid metadata')); }
    });
  });
}

function compactFormat(format) {
  return {
    format_id: format.format_id,
    ext: format.ext,
    resolution: format.resolution || (format.height ? `${format.height}p` : 'audio'),
    fps: format.fps || null,
    vcodec: format.vcodec,
    acodec: format.acodec,
    filesize: format.filesize || format.filesize_approx || null,
    note: format.format_note || '',
  };
}

function normalizeInfo(raw, requestedUrl) {
  const entries = Array.isArray(raw.entries) ? raw.entries.filter(Boolean) : [];
  const source = raw._type === 'playlist' ? raw : raw;
  return {
    kind: raw._type === 'playlist' || entries.length > 0 ? 'playlist' : 'video',
    id: raw.id || requestedUrl,
    title: raw.title || 'Untitled media',
    uploader: raw.uploader || raw.channel || '',
    thumbnail: raw.thumbnail || '',
    duration: raw.duration || null,
    webpage_url: raw.webpage_url || requestedUrl,
    playlist_count: entries.length,
    entries: entries.map((item, index) => ({
      index: index + 1,
      id: item.id,
      title: item.title || `Video ${index + 1}`,
      duration: item.duration || null,
      thumbnail: item.thumbnail || '',
      webpage_url: item.webpage_url || (item.url && item.url.startsWith('http') ? item.url : ''),
    })),
    formats: Array.isArray(source.formats) ? source.formats.filter((f) => f.vcodec !== 'none' || f.acodec !== 'none').slice(-40).map(compactFormat) : [],
  };
}

function safeName(value) {
  return String(value || 'yt-forge-download').replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(0, 120) || 'yt-forge-download';
}

async function handleInfo(req, res, url) {
  if (!validUrl(url)) return json(res, 400, { error: 'Enter a valid http(s) URL.' });
  try {
    const raw = await runYtDlp(['--dump-single-json', '--flat-playlist', '--skip-download', url], { jsonOutput: true });
    json(res, 200, normalizeInfo(raw, url));
  } catch (error) {
    json(res, 502, { error: error.message });
  }
}

function handleDownload(req, res, url, format) {
  if (!validUrl(url)) return json(res, 400, { error: 'Enter a valid http(s) URL.' });
  const chosenFormat = ['mp4', 'mp3', 'm4a', 'best'].includes(format) ? format : 'mp4';
  const formatArg = chosenFormat === 'mp3' ? 'bestaudio/best' : chosenFormat === 'm4a' ? 'bestaudio[ext=m4a]/bestaudio' : chosenFormat === 'best' ? 'best' : 'best[ext=mp4]/best';
  const child = spawn(binaryPath(), ['--no-warnings', '--ignore-config', '--no-playlist', '-f', formatArg, '--print', 'after_move:filepath', '-o', '-', url], { windowsHide: true });
  let stderr = '';
  let headerSent = false;
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.stdout.once('data', (chunk) => {
    if (!headerSent) {
      headerSent = true;
      res.writeHead(200, {
        'content-type': chosenFormat === 'mp3' || chosenFormat === 'm4a' ? 'audio/mpeg' : 'video/mp4',
        'content-disposition': `attachment; filename="${safeName(url)}.${chosenFormat === 'best' ? 'mp4' : chosenFormat}"`,
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      });
    }
    res.write(chunk);
    child.stdout.pipe(res);
  });
  child.on('error', (error) => { if (!headerSent) json(res, 502, { error: error.message }); else res.destroy(error); });
  child.on('close', (code) => { if (!headerSent && code !== 0) json(res, 502, { error: stderr.trim() || `yt-dlp exited with code ${code}` }); });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-allow-headers': 'content-type' });
    return res.end();
  }
  if (requestUrl.pathname === '/api/health') return json(res, 200, { ok: true, engine: existsSync(binaryPath()) ? 'yt-dlp-ready' : 'yt-dlp-missing' });
  if (requestUrl.pathname === '/api/info') return handleInfo(req, res, requestUrl.searchParams.get('url') || '');
  if (requestUrl.pathname === '/api/download') return handleDownload(req, res, requestUrl.searchParams.get('url') || '', requestUrl.searchParams.get('format') || 'mp4');
  json(res, 404, { error: 'Not found' });
});

server.listen(port, '127.0.0.1', () => console.log(`YT-FORGE local engine listening at http://localhost:${port}`));
