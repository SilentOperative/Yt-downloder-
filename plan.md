# YT-FORGE Web Migration Plan

## Goal

Convert YT-FORGE from an Electron desktop application into a desktop-browser website for Windows, Linux, and macOS. The active repository is web-first at its root; desktop Electron source, release packaging, and desktop build configuration are no longer part of the active application.

## Implementation approach

- Use the root React/Vite application as the browser control surface.
- Keep only the platform yt-dlp binaries needed by the local companion service.
- Use `server/index.mjs` as a small local API that invokes the platform-appropriate binary and streams browser downloads.
- Store history and preferences in browser local storage.
- Keep the layout desktop-oriented and show an explicit desktop-browser message on narrow phone screens.
- Use the root Vercel configuration to publish the static UI, with documentation explaining that Vercel cannot access a visitor's local filesystem or executable.

## Design

Chosen direction: restrained studio utility with graphite surfaces. The UI uses dark graphite panels, an electric violet action color, compact status pills, monospaced technical metadata, short loading motion, and direct operational copy. The YT-FORGE product identity is preserved.

## Structure

- `src/` contains the browser React UI.
- `server/` contains the local yt-dlp API.
- `public/` contains static route metadata.
- `bin/` contains the platform yt-dlp binaries used by local mode.
- `package.json`, `vite.config.js`, and `vercel.json` define local development, production build, and manual Vercel deployment.
- `README.md` documents the local-first architecture and deployment boundary.
