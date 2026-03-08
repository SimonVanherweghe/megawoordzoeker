# Mega woordzoeker

Build a large-scale, client-side word search puzzle generator optimized for plotter printers (A0/A1 sizes). The application must be built using ViteJS and operate entirely in the browser without a backend.

## 1. Core Generation Algorithm

Grid Representation: Represent the 2D grid as a 1D array in memory to optimize spatial calculations and coordinate offsets.

Placement Strategy: Do not use strict depth-first search backtracking, as it will hit an exponential time complexity boundary ($O(m \times n \times 3^k)$) causing the browser to freeze on massive grids. Instead, use a randomized greedy algorithm.

Sorting: Sort the incoming word list by length in descending order and attempt to place the longest words first to ensure higher packing efficiency.

Orientation: Words can be placed in any of the 8 directions (horizontal, vertical, and all diagonals).
Execution: Offload the generation algorithm to a background Web Worker using a library like vite-plugin-comlink to prevent blocking the main UI thread.

## 1. Hidden Message Logic

After placing the target words, calculate the remaining empty cells. If the empty cells are fewer than the hidden message length, trigger an error prompting the user to resize the grid or reduce the word count.
Inject the user-provided hidden message sequentially into the remaining empty grid cells reading from left to right, top to bottom.

Fill the remaining deficit of empty cells with random alphabetic characters.

## 3. Vocabulary Extraction (Wikipedia API)

Fetching: Implement a client-side fetch request to the MediaWiki API using the origin=* parameter to bypass CORS restrictions. Use the action=query endpoint to fetch both the article text and related links.

Parsing: Sanitize the returned text by removing HTML, punctuation, numbers, and common stop words to create an index of viable puzzle words.
Crawling: Implement a Depth-Limited Breadth-First Search to recursively follow the extracted internal Wikipedia links to gather a massive vocabulary list suitable for plotter-sized puzzles.

State Management: Serialize and store the compiled word list in the browser's localStorage. Build a UI allowing the user to view, edit, delete, or manually overwrite these stored words before generating the puzzle.

## 4. Rendering & Export Pipeline

UI Preview: Render the interactive grid preview using the HTML5 <canvas> API rather than the HTML DOM, as massive DOM trees (e.g., 20,000+ nodes) will severely degrade performance and cause UI locking. Implement viewport virtualization so only the currently visible cells are calculated and drawn on the canvas during scrolling.

Plotter Export: For the final plotter-ready file, bypass the canvas and generate a Scalable Vector Graphics (SVG) representation entirely in-memory as a string. SVGs provide the infinite scalability and precise vector geometric paths required by mechanical pen plotters. Export this string as a downloadable .svg file.

## 5. Testing Requirements

Implement comprehensive tests using Vitest.
Write unit tests to verify the grid collision detection, ensuring intersecting words sharing an identical letter validate correctly, while mismatched letters are rejected.
Write integration tests verifying the sequential left-to-right, top-to-bottom array injection of the hidden message.
Mock the external Wikipedia API fetch calls to ensure the text sanitization, crawling, and extraction logic can be tested reliably in isolation without network flakiness.
