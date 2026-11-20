import { chmod, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

const target = join(process.cwd(), 'bin', 'yt-dlp_linux_x64');

try {
  const response = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'YT-FORGE-build-updater' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GitHub release lookup returned HTTP ${response.status}`);
  const release = await response.json();
  const asset = release.assets?.find((item) => item.name === 'yt-dlp_linux');
  if (!asset?.browser_download_url) throw new Error('Latest yt-dlp Linux binary was not found in the release.');

  const binaryResponse = await fetch(asset.browser_download_url, {
    headers: { 'user-agent': 'YT-FORGE-build-updater' },
    redirect: 'follow',
    signal: AbortSignal.timeout(60000),
  });
  if (!binaryResponse.ok) throw new Error(`Binary download returned HTTP ${binaryResponse.status}`);
  const bytes = Buffer.from(await binaryResponse.arrayBuffer());
  if (bytes.length < 1_000_000) throw new Error('Downloaded yt-dlp binary is unexpectedly small.');

  await mkdir(join(process.cwd(), 'bin'), { recursive: true });
  const temporary = `${target}.tmp`;
  const { writeFile, rename } = await import('node:fs/promises');
  await writeFile(temporary, bytes);
  await chmod(temporary, 0o755);
  await rename(temporary, target);
  console.log(`[YT-FORGE] Updated yt-dlp from release ${release.tag_name}.`);
} catch (error) {
  try {
    await access(target, constants.X_OK);
    console.warn(`[YT-FORGE] Could not update yt-dlp; keeping bundled binary: ${error.message}`);
  } catch {
    console.error(`[YT-FORGE] No usable yt-dlp binary is available: ${error.message}`);
    process.exitCode = 1;
  }
}
