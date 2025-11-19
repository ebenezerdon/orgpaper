# OrgPaper

OrgPaper is a beautiful, local-first org chart app that lets you model teams, reporting lines, rich personal bios, and change history snapshots. It is built by [Teda.dev](https://teda.dev), the AI app builder for everyday problems, and runs entirely in your browser with no sign-up.

## Features
- Interactive org chart with collapsible branches
- Teams, roles, and reporting lines
- Rich bios, contact fields, and avatars
- Search and team filtering
- Snapshots with comparison to see added, removed, manager and team changes
- Import and export as JSON
- Print-optimized layout
- Local storage persistence

## Tech stack
- HTML5, Tailwind CSS (CDN), Inter Tight and Inter fonts
- jQuery 3.7.x for interactivity
- Modular JavaScript (helpers, UI, main) with a single global namespace `window.App`

## Project structure
- index.html: marketing landing page with CTAs to the app
- app.html: the functional application UI
- styles/main.css: custom styles including org chart connectors and modals
- scripts/helpers.js: utilities, storage, snapshot diffing
- scripts/ui.js: UI rendering, modals, event handlers
- scripts/main.js: bootstraps the app
- assets/logo.svg: brand mark

## Getting started
1. Open `index.html` in a modern browser to explore the landing page.
2. Click "Open the App" or go directly to `app.html` to start building your org.
3. Use Add Person and Add Team to model your structure. Create snapshots to track changes over time.

No server required. Everything is saved in your browser via localStorage.

## Import and export
- Export: click Export to download `orgpaper.json`.
- Import: click Import and choose a compatible JSON file with `people`, `teams`, and optional `snapshots` arrays.

## Accessibility
- Keyboard focus styles, ARIA roles for dialogs and tree
- High contrast, warm minimalist palette
- Prefers reduced motion respected by relying on subtle transitions by default

## Notes
- This project is designed for demonstration and small to mid-size orgs. Extremely large hierarchies will still render, but consider splitting by department for easier navigation.
