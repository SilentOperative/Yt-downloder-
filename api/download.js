import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { binaryPath, explainYtDlpError, json, validUrl } from '../lib/yt.js';

function safeName(value) {
  return String(value || 'yt-forge-download').replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(0, 120) || 'yt-forge-download';
}

export default function handler(req, res) {
  const url = req.query?.url || '';
  const format = ['mp4', 'm4a', 'best'].includes(req.query?.format) ? req.query.format : 'mp4';
  const requestedQuality = String(req.query?.quality || 'best');
  const validQuality = requestedQuality === 'best' || ['2160', '1440', '1080', '720', '480', '360'].includes(requestedQuality);
  const height = validQuality && requestedQuality !== 'best' ? `[height<=${requestedQuality}]` : '';
  if (!validUrl(url)) return json(res, 400, { error: 'Enter a valid http(s) URL.' });
  const formatArg = format === 'mp3'
    ? 'bestaudio/best'
    : format === 'm4a'
      ? 'bestaudio[ext=m4a]/bestaudio'
      : format === 'best'
        ? `best${height}/best`
        : `best[ext=mp4]${height}/best${height}/best`;
  if (!existsSync(binaryPath())) return json(res, 503, { error: 'The yt-dlp binary is missing from this deployment. Check the Vercel function includeFiles configuration and bin/yt-dlp_linux_x64.' });
  const child = spawn(binaryPath(), ['--no-warnings', '--ignore-config', '--no-playlist', '--no-part', '-f', formatArg, '-o', '-', url]);
  let stderr = '';
  let headerSent = false;
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.stdout.once('data', (chunk) => {
    headerSent = true;
    res.statusCode = 200;
    res.setHeader('content-type', format === 'm4a' ? 'audio/mp4' : 'video/mp4');
    res.setHeader('content-disposition', `attachment; filename="${safeName(url)}.${format === 'best' ? 'mp4' : format}"`);
    res.setHeader('cache-control', 'no-store');
    res.write(chunk);
    child.stdout.pipe(res);
  });
  child.on('error', (error) => { if (!headerSent) json(res, 502, { error: explainYtDlpError(error.message) }); else res.destroy(error); });
  child.on('close', (code) => {
    if (!headerSent && code !== 0) json(res, 502, { error: explainYtDlpError(stderr.trim() || `yt-dlp exited with code ${code}`) });
    else if (!headerSent && code === 0) json(res, 502, { error: 'The media engine finished without returning a file. Try another format or update yt-dlp.' });
  });
}

export const config = { maxDuration: 60 };
