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
    const raw = String(value || '');
    if (!raw || raw.length > 4096) return false;
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '0.0.0.0' || host === '::1' || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
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

export function explainYtDlpError(message) {
  const text = String(message || '').trim();
  if (/sign in to confirm|confirm you're not a bot|confirm you are not a bot/i.test(text)) {
    return 'YouTube is currently requiring additional verification for this video. YT-FORGE does not require an account and does not use sign-in cookies, but it cannot bypass YouTube verification. Try a different publicly accessible video or retry later. If YouTube continues to restrict this video, use the creator’s official playback or download options where available.';
  }
  if (/HTTP Error 429|Too Many Requests/i.test(text)) {
    return 'YouTube is rate-limiting requests. Wait before retrying.';
  }
  if (/Unsupported URL/i.test(text)) {
    return 'This URL is not supported by the installed yt-dlp version.';
  }
  return text || 'yt-dlp could not complete this request.';
}

export function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const binary = binaryPath();
    if (!existsSync(binary)) return reject(new Error('The Vercel yt-dlp binary is not available.'));
    const child = spawn(binary, ['--no-warnings', '--ignore-config', '--socket-timeout', '15', '--retries', '2', ...args]);
    const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Media inspection timed out. Please try again.')); }, 45000);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => { clearTimeout(timeout); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(explainYtDlpError(stderr.trim() || `yt-dlp exited with code ${code}`)));
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
