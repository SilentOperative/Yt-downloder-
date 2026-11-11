import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

export function binaryPath() {
  // Vercel functions run on Linux x64. Local desktop mode keeps its own
  // platform selection in server/index.mjs.
  return join(process.cwd(), 'bin', 'yt-dlp_linux_x64');
}

export function validUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function compactFormat(format) {
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

export function normalizeInfo(raw, requestedUrl) {
  const entries = Array.isArray(raw.entries) ? raw.entries.filter(Boolean) : [];
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
    formats: Array.isArray(raw.formats)
      ? raw.formats.filter((f) => f.vcodec !== 'none' || f.acodec !== 'none').slice(-40).map(compactFormat)
      : [],
  };
}

export function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const binary = binaryPath();
    if (!existsSync(binary)) return reject(new Error('The Vercel yt-dlp binary is not available.'));
    const child = spawn(binary, ['--no-warnings', '--ignore-config', ...args]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('yt-dlp returned invalid metadata.')); }
    });
  });
}

export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}
