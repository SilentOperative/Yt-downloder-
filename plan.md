# YT-FORGE Web Migration Plan

## Goal

Preserve the existing YT-FORGE desktop application while adding a desktop-browser website for Windows, Linux, and macOS. The web version keeps the compact creator-tool workflow and runs downloads locally through a companion Node service.

## Implementation approach

- Keep the existing Electron app, platform binaries, assets, and release files in the repository.
- Add a self-contained `web/` React/Vite browser application.
- Add `web/server/index.mjs`, a local API that invokes the platform-appropriate `yt-dlp` binary and streams browser downloads.
- Store history and preferences in browser local storage.
- Keep the layout desktop-oriented and show an explicit desktop-browser message on narrow phone screens.
- Include Vercel settings for publishing the static UI, with documentation explaining that Vercel cannot access a visitor's local filesystem or executable.

## Design

Chosen direction: restrained studio utility with graphite surfaces. The UI uses dark graphite panels, an electric violet action color, compact status pills, monospaced technical metadata, short loading motion, and direct operational copy. The existing YT-FORGE mark and product identity are preserved.

## Structure

- Existing root `src/`, `bin/`, `release/`, and Electron configuration remain the desktop distribution.
- `web/src/` contains the browser UI.
- `web/server/` contains the local yt-dlp API.
- `web/public/` contains static route metadata.
- `web/README.md` contains local and Vercel deployment instructions.
