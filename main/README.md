# CyberTimeline (React + Vite)

Interactive cyber-incident timeline and CTF board. Enter or import events, visualize them with D3, and optionally extract incidents from uploaded reports with an AI agent (OpenAI API or a local Ollama model). Everything persists to localStorage so you can refresh without losing user-added data.

## Features
- Timeline visualization (D3): severity-colored nodes, zoom/pan, badge details, configurable badge fields, group-by (entity, severity, host, system, team, tactic, name), optional team-tinted lanes, and custom red/blue connection lines.
- Event management: add/edit events inline, drag/drop to reorder lanes, import/export JSON, clear user data, and severity filtering. Events are stored under the `cybertimeline_user_incidents_v1` localStorage key.
- AI report analysis: upload text/CSV/DOC/DOCX, send to OpenAI (needs API key) or a local Ollama model, view extracted events with confidence coloring, open the raw model output (`/AIoutput.html`), and push extracted events into the main timeline.
- CTF board: drag events between Red/Blue/Gray columns to sketch adversary/defender timelines.
- Theming and branding: light/dark toggle, Glass Onion logo assets, and compact controls panel for filters and grouping.

## Getting Started
```bash
npm install
npm run dev    # starts Vite dev server
npm run build  # production build
npm run preview
```

## AI Agent Setup
- **OpenAI**: set `VITE_OPENAI_API_KEY` (or paste a key in the UI) and optionally override the API endpoint. Model used: `gpt-4o`.
- **Ollama**: toggle “Use Local LLM” and provide a model name (default `qwen3:8b`). The app calls `http://localhost:11434/api/generate`; ensure Ollama is running and the model is pulled.
- Raw responses and timing are stored in localStorage (`lastLLMRaw`, `lastLLMTime`, `lastLLMModel`, `lastLLMDuration`) for the `/AIoutput.html` viewer.

## Event Import/Export Format
The import/export JSON is an array of event objects. Minimal required fields are `id`, `title`, `asset`, and `start` (ISO timestamp). Example:
```json
[
  {
    "id": "evt-1",
    "title": "Suspicious PowerShell",
    "asset": "WIN-01",
    "host": "win-01.corp",
    "category": "EDR",
    "team": "Blue",
    "tactic": "TA0002 Execution",
    "start": "2024-12-01T10:35:00Z",
    "end": null,
    "severity": "high",
    "description": "Encoded PowerShell spawned from Outlook."
  }
]
```
Missing optional fields default to sensible values (e.g., unknown tactic inferred from title/description, severity defaults to `low`). Import requires `start` and will supply an `id` when missing.

## Tech Stack
- React 19 + Vite 7
- D3 v7 for SVG timeline rendering
- ESLint 9 config (JS) for linting

## Project Layout
- `src/App.jsx` — main app, timeline rendering (D3), event editor, AI analysis flow, CTF board.
- `src/App.css` — styling, layout, theme, and timeline visuals.
- `public/AIoutput.html` — viewer for the last stored raw AI response.
- `public/incidents.json` — sample incidents file (not auto-loaded; user data starts empty).

## Notes
- All user events and AI outputs live in the browser’s localStorage; clearing storage removes them.
- The app ships without default incidents; add or import your own to see the timeline populate.
