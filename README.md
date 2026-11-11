# YT-FORGE Web

YT-FORGE is now a desktop-browser website for Windows, Linux, and macOS. The original Electron desktop packaging has been removed from the active application and the web version is now the repository root.

## How the local-first website works

A normal browser cannot execute a visitor's local `yt-dlp` binary or write directly to arbitrary filesystem folders. To keep the download work local, this project includes a small companion Node service in `server/index.mjs`. The browser UI talks to that service at `http://localhost:8787`; the service invokes the platform-specific binary in `bin/` and returns a normal browser download.

This means the interface is a website, while extraction and downloads stay on the user's Windows, Linux, or macOS computer. A Vercel deployment can host the website interface, but a deployed page cannot access the visitor's local executable unless the local companion service is running and reachable through a browser-allowed HTTPS endpoint.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in a desktop browser. The phone layout is intentionally not supported.

## Deploy manually to Vercel

Use the repository root as Vercel's Root Directory. The configured build command is `npm run build` and the output directory is `dist`. Vercel will host the browser UI; local downloading still uses the companion service described above.

Only download media you have permission to access or distribute.
