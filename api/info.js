import { json, normalizeInfo, runYtDlp, validUrl } from '../lib/yt.js';

export default async function handler(req, res) {
  const url = req.query?.url || '';
  if (!validUrl(url)) return json(res, 400, { error: 'Enter a valid http(s) URL.' });
  try {
    const raw = await runYtDlp(['--dump-single-json', '--flat-playlist', '--skip-download', url]);
    return json(res, 200, normalizeInfo(raw, url));
  } catch (error) {
    return json(res, 502, { error: error.message });
  }
}

export const config = { maxDuration: 60 };
