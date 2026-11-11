# YT-FORGE Web

YT-FORGE is now a browser website for desktop and mobile browsers. The original Electron desktop packaging has been removed from the active application and the web version is now the repository root. The visual interface is shared across screen sizes; mobile changes the layout geometry without changing the controls or workflow.

## How the local-first website works

A normal browser cannot execute a visitor's local `yt-dlp` binary or write directly to arbitrary filesystem folders. To keep the download work local, this project includes a small companion Node service in `server/index.mjs`. The browser UI talks to that service at `http://localhost:8787`; the service invokes the platform-specific binary in `bin/` and returns a normal browser download.

This means the interface is a website, while local development keeps extraction and downloads on the user's computer. For a deployed Vercel website, `api/health.js`, `api/info.js`, and `api/download.js` provide the server-side backend using the bundled Linux yt-dlp binary, so desktop and mobile browsers can use the deployed site without running a local companion service.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in any modern desktop or mobile browser. The same UI is used at every size.

## Deploy manually to Vercel

Use the repository root as Vercel's Root Directory. The configured build command is `npm run build` and the output directory is `dist`. Vercel will host the browser UI and the `/api/*` backend functions. Vercel execution is temporary and has platform time/size limits for large or long downloads.

Only download media you have permission to access or distribute.
