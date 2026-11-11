import { existsSync } from 'node:fs';
import { binaryPath, json } from '../lib/yt.js';

export default function handler(req, res) {
  json(res, 200, { ok: true, engine: existsSync(binaryPath()) ? 'yt-dlp-ready' : 'yt-dlp-missing', runtime: 'vercel' });
}

export const config = { maxDuration: 10 };
