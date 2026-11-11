# YT-FORGE Web

This is the desktop-browser edition of YT-FORGE for Windows, Linux, and macOS. It preserves the compact desktop workflow while moving the UI into a browser.

## Important architecture note

A normal browser cannot execute a visitor's local `yt-dlp` binary or write directly to arbitrary filesystem folders. Therefore this project has two pieces:

1. `web/src/` is the browser control surface.
2. `web/server/index.mjs` is a local companion service that invokes the platform-specific binary already in `../bin/` and streams the result back as a browser download.

When run locally, extraction and downloads stay on the user's computer. A Vercel deployment can host the static interface, but it cannot run the visitor's local binary. To use the fully local workflow, run the web app locally or point the deployed interface at a separately hosted HTTPS API.

## Run locally

From this directory:

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in a desktop browser. The local engine listens on `http://localhost:8787`.

On Linux, the included binary is selected by CPU architecture. On macOS and Windows, the matching binary in `../bin/` is selected automatically. Download only media you have permission to access or distribute.

## Build and deploy the UI to Vercel

Set Vercel's Root Directory to `web`, then use:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

The Vercel version is the browser control surface. It does not provide local filesystem access or run the desktop `yt-dlp` executable.
