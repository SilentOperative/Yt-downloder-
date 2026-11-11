import { spawn } from 'node:child_process';
import { binaryPath, json, validUrl } from '../lib/yt.js';

function safeName(value) {
  return String(value || 'yt-forge-download').replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(0, 120) || 'yt-forge-download';
}

export default function handler(req, res) {
  const url = req.query?.url || '';
  const format = ['mp4', 'mp3', 'm4a', 'best'].includes(req.query?.format) ? req.query.format : 'mp4';
  const requestedQuality = String(req.query?.quality || 'best');
  const validQuality = requestedQuality === 'best' || ['2160', '1440', '1080', '720', '480', '360'].includes(requestedQuality);
  const height = validQuality && requestedQuality !== 'best' ? `[height<=${requestedQuality}]` : '';
  if (!validUrl(url)) return json(res, 400, { error: 'Enter a valid http(s) URL.' });
  const formatArg = format === 'mp3'
    ? 'bestaudio/best'
    : format === 'm4a'
      ? 'bestaudio[ext=m4a]/bestaudio'
      : format === 'best'
        ? `bestvideo${height}+bestaudio/best${height}/best`
        : `bestvideo[ext=mp4]${height}+bestaudio[ext=m4a]/best[ext=mp4]${height}/best${height}`;
  const child = spawn(binaryPath(), ['--no-warnings', '--ignore-config', '--no-playlist', '-f', formatArg, '-o', '-', url]);
  let stderr = '';
  let headerSent = false;
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.stdout.once('data', (chunk) => {
    headerSent = true;
    res.statusCode = 200;
    res.setHeader('content-type', format === 'mp3' || format === 'm4a' ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('content-disposition', `attachment; filename="${safeName(url)}.${format === 'best' ? 'mp4' : format}"`);
    res.setHeader('cache-control', 'no-store');
    res.write(chunk);
    child.stdout.pipe(res);
  });
  child.on('error', (error) => { if (!headerSent) json(res, 502, { error: error.message }); else res.destroy(error); });
  child.on('close', (code) => { if (!headerSent && code !== 0) json(res, 502, { error: stderr.trim() || `yt-dlp exited with code ${code}` }); });
}

export const config = { maxDuration: 60 };
