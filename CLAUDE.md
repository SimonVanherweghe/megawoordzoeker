# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mega woordzoeker** is a large-scale, client-side word search puzzle generator optimized for plotter printers (A0/A1 sizes). It runs entirely in the browser with no backend.

## Stack

- **Build tool:** ViteJS
- **Testing:** Vitest
- **Language:** TypeScript
- **Key plugin:** `vite-plugin-comlink` for Web Worker integration

## Commands

Once `package.json` is initialized (project is currently spec-only):

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run test      # Run Vitest tests
npm run test -- --run path/to/test.spec.ts  # Run a single test file
```

## Grid Dimensions

Grid size is derived from physical measurements:

- **Cell size**: configurable, default **2.5 cm** (range: 2–3 cm)
- **Width**: plotter max ~90 cm → default **36 columns** (90 / 2.5)
- **Height**: configurable length in cm → default **80 rows** (200 cm / 2.5), max ~120 rows (300 cm)
- UI exposes width (cm), height (cm), and cell size (cm); columns/rows are computed, not entered directly

## Word Lists (A/B split)

Wikipedia vocabulary is split into two lists:

- **A-list**: words ≥ 6 characters — placed first, shown in the puzzle's word list for the solver
- **B-list**: words 3–5 characters — used by the placement algorithm to fill gaps; **not** shown in the word list
- Absolute minimum word length: **3 characters**
- Wikipedia language: **Dutch** (`nl.wikipedia.org`) — optionally configurable to other languages

## Architecture

The application has five main concerns:

### 1. Core Generation Algorithm (`src/worker/`)
- Grid stored as a **1D array** (not 2D) for optimized spatial calculations
- **Randomized greedy algorithm** — NOT depth-first backtracking (avoids O(m×n×3^k) complexity)
- Words sorted by length descending before placement; 8-directional placement
- Runs in a **Web Worker** via `vite-plugin-comlink` to avoid blocking the UI thread

### 2. Hidden Message Logic
- After word placement, remaining empty cells receive the hidden message left-to-right, top-to-bottom
- If empty cells < message length → surface an error to the user
- Remaining deficit cells filled with random alphabetic characters

### 3. Vocabulary Extraction (`src/wikipedia/`)
- MediaWiki API with `origin=*` to bypass CORS; uses `action=query` for text + links
- Target: Dutch Wikipedia (`nl.wikipedia.org`), optionally configurable
- Text sanitization: strip HTML, punctuation, numbers, Dutch stop words
- **Depth-Limited BFS** (depth limit: **3**) to crawl internal Wikipedia links for a large vocabulary
- Words split into A-list (≥6 chars) and B-list (3–5 chars) after extraction
- Compiled word lists persisted in **localStorage** with a UI to view/edit/delete words

### 4. Rendering & Export (`src/renderer/`)
- **Canvas API** for the interactive preview (not DOM — DOM degrades with 20,000+ nodes)
- **Viewport virtualization**: only visible cells are calculated and drawn during scroll
- **SVG export**: generated entirely in-memory as a string (not derived from canvas) for plotter-ready vector output; exported as a `.svg` download

### 5. Testing
- **Unit tests:** grid collision detection (intersecting words must share identical letters)
- **Integration tests:** sequential hidden message injection into the grid array
- **Mocked API tests:** Wikipedia fetch/sanitize/crawl logic tested without network calls
