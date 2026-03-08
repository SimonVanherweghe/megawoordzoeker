import type { Direction, GridConfig, GridDimensions, PlacedWord, GenerationOutcome, GenerationOptions } from './types.ts'

export function computeDimensions(config: GridConfig): GridDimensions {
  return {
    cols: Math.floor(config.widthCm / config.cellSizeCm),
    rows: Math.floor(config.heightCm / config.cellSizeCm),
  }
}

// Direction vectors: exported so consumers can compute cell indices for placed words
export const DIRECTION_VECTORS: [number, number][] = [
  [1, 0],   // 0: right
  [-1, 0],  // 1: left
  [0, 1],   // 2: down
  [0, -1],  // 3: up
  [1, 1],   // 4: down-right
  [-1, -1], // 5: up-left
  [1, -1],  // 6: up-right
  [-1, 1],  // 7: down-left
]

export function getWordCells(pw: PlacedWord, cols: number): number[] {
  const [dc, dr] = DIRECTION_VECTORS[pw.direction]
  const startCol = pw.startIndex % cols
  const startRow = Math.floor(pw.startIndex / cols)
  return Array.from({ length: pw.word.length }, (_, i) => {
    const col = startCol + dc * i
    const row = startRow + dr * i
    return row * cols + col
  })
}

function canPlace(
  grid: string[],
  word: string,
  startIndex: number,
  direction: Direction,
  cols: number,
  rows: number,
  reserved?: Set<number>,
): boolean {
  const [dc, dr] = DIRECTION_VECTORS[direction]
  const startCol = startIndex % cols
  const startRow = Math.floor(startIndex / cols)

  for (let i = 0; i < word.length; i++) {
    const col = startCol + dc * i
    const row = startRow + dr * i
    if (col < 0 || col >= cols || row < 0 || row >= rows) return false
    const cellIdx = row * cols + col
    if (reserved?.has(cellIdx)) return false
    const existing = grid[cellIdx]
    if (existing !== '' && existing !== word[i]) return false
  }
  return true
}

function placeWord(
  grid: string[],
  word: string,
  startIndex: number,
  direction: Direction,
  cols: number,
): void {
  const [dc, dr] = DIRECTION_VECTORS[direction]
  const startCol = startIndex % cols
  const startRow = Math.floor(startIndex / cols)
  for (let i = 0; i < word.length; i++) {
    const col = startCol + dc * i
    const row = startRow + dr * i
    grid[row * cols + col] = word[i]
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function tryPlaceWord(
  grid: string[],
  word: string,
  cols: number,
  rows: number,
  rng: () => number,
): { startIndex: number; direction: Direction } | null {
  const size = cols * rows
  const positions = shuffle(Array.from({ length: size }, (_, i) => i), rng)
  const directions = shuffle([0, 1, 2, 3, 4, 5, 6, 7] as Direction[], rng)

  for (const pos of positions) {
    for (const dir of directions) {
      if (canPlace(grid, word, pos, dir, cols, rows)) {
        return { startIndex: pos, direction: dir }
      }
    }
  }
  return null
}

/**
 * Structured row-scan pass: fills remaining empty spans horizontally.
 * Runs before the exhaustive pass to avoid isolated cells.
 * Returns placed B-words for tracking.
 */
function fillGapsRowScan(
  grid: string[],
  cols: number,
  rows: number,
  words: string[],
  rng: () => number,
  skip: Set<number>,
  usedWords: Set<string>,
): PlacedWord[] {
  const result: PlacedWord[] = []
  if (words.length === 0) return result

  const byLength = new Map<number, string[]>()
  for (const w of words) {
    const u = w.toUpperCase()
    if (usedWords.has(u)) continue
    if (!byLength.has(u.length)) byLength.set(u.length, [])
    byLength.get(u.length)!.push(u)
  }
  for (const [, arr] of byLength) shuffle(arr, rng)
  const lengths = [...byLength.keys()].sort((a, b) => b - a)

  let improved = true
  while (improved) {
    improved = false
    for (let row = 0; row < rows; row++) {
      let col = 0
      while (col < cols) {
        const idx = row * cols + col
        if (grid[idx] !== '' || skip.has(idx)) { col++; continue }

        let runEnd = col
        while (
          runEnd < cols &&
          grid[row * cols + runEnd] === '' &&
          !skip.has(row * cols + runEnd)
        ) runEnd++
        const runLen = runEnd - col

        if (runLen < 3) { col++; continue }

        let placed = false
        for (const len of lengths) {
          if (placed || len > runLen) continue
          const arr = byLength.get(len) ?? []
          for (const word of arr) {
            if (usedWords.has(word)) continue
            const startIndex = row * cols + col
            if (canPlace(grid, word, startIndex, 0 as Direction, cols, rows, skip)) {
              placeWord(grid, word, startIndex, 0 as Direction, cols)
              usedWords.add(word)
              result.push({ word, startIndex, direction: 0, isAList: false })
              improved = true
              placed = true
              break
            }
          }
        }
        col++
      }
    }
  }
  return result
}

/**
 * Exhaustively tries to place B-list words (each at most once) through every remaining
 * empty cell (excluding any indices in `skip`). Loops until a full pass makes no progress.
 * Re-shuffles available words each outer pass so different orderings are tried.
 * Returns placed B-words for tracking.
 */
function fillGapsExhaustively(
  grid: string[],
  cols: number,
  rows: number,
  words: string[],
  rng: () => number,
  skip: Set<number> = new Set(),
  usedWords: Set<string> = new Set(),
): PlacedWord[] {
  const result: PlacedWord[] = []
  if (words.length === 0) return result
  const allUpperWords = words.map((w) => w.toUpperCase())

  let improved = true
  while (improved) {
    improved = false
    const orderedWords = shuffle(allUpperWords.filter((w) => !usedWords.has(w)), rng)
      .sort((a, b) => b.length - a.length)

    if (orderedWords.length === 0) break

    for (let idx = 0; idx < grid.length; idx++) {
      if (grid[idx] !== '' || skip.has(idx)) continue

      let placed = false
      for (const word of orderedWords) {
        if (placed || usedWords.has(word)) break
        for (let dir = 0; dir < 8 && !placed; dir++) {
          const direction = dir as Direction
          const [dc, dr] = DIRECTION_VECTORS[direction]
          for (let pos = 0; pos < word.length && !placed; pos++) {
            const startCol = (idx % cols) - dc * pos
            const startRow = Math.floor(idx / cols) - dr * pos
            if (startCol < 0 || startCol >= cols || startRow < 0 || startRow >= rows) continue
            const startIndex = startRow * cols + startCol
            if (canPlace(grid, word, startIndex, direction, cols, rows, skip)) {
              placeWord(grid, word, startIndex, direction, cols)
              usedWords.add(word)
              result.push({ word, startIndex, direction, isAList: false })
              improved = true
              placed = true
            }
          }
        }
      }
    }
  }
  return result
}

const MAX_ATTEMPTS = 5

export function generateGrid(options: GenerationOptions): GenerationOutcome {
  // Isolated cells can form by bad luck — retry with fresh random state
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const outcome = generateGridAttempt(options)
    if (outcome.ok || outcome.error.type !== 'UNFILLABLE_CELLS') return outcome
  }
  return {
    ok: false,
    error: {
      type: 'UNFILLABLE_CELLS',
      message: `Kon het raster niet volledig vullen na ${MAX_ATTEMPTS} pogingen. Voeg meer B-woorden toe of vergroot het raster.`,
    },
  }
}

function generateGridAttempt(options: GenerationOptions): GenerationOutcome {
  const { gridConfig, aList, bList, hiddenMessage } = options
  const { cols, rows } = computeDimensions(gridConfig)
  const size = cols * rows
  const grid: string[] = Array(size).fill('')
  const rng = Math.random

  const sortedA = [...aList].sort((a, b) => b.length - a.length)
  const placed: PlacedWord[] = []
  const usedWords = new Set<string>()

  // Place A-list words first (B-words are handled entirely by gap fill)
  for (const word of sortedA) {
    const upper = word.toUpperCase()
    if (usedWords.has(upper)) continue
    const result = tryPlaceWord(grid, upper, cols, rows, rng)
    if (result) {
      placeWord(grid, upper, result.startIndex, result.direction, cols)
      usedWords.add(upper)
      placed.push({ word, startIndex: result.startIndex, direction: result.direction, isAList: true })
    }
  }

  const message = hiddenMessage.toUpperCase().replace(/[^A-Z]/g, '')

  // Find all empty cells in L-to-R, T-to-B order
  const allEmpty = grid.reduce<number[]>((acc, cell, i) => (cell === '' ? [...acc, i] : acc), [])

  if (allEmpty.length < message.length) {
    return {
      ok: false,
      error: {
        type: 'NOT_ENOUGH_CELLS',
        message: `Niet genoeg lege cellen voor het verborgen bericht. Vergroot het raster of verklein het bericht. (${allEmpty.length} cellen vrij, ${message.length} nodig)`,
      },
    }
  }

  // Spread message evenly across all empty cells so it isn't clustered at the top
  const step = allEmpty.length / message.length
  const hiddenMessageIndices = Array.from({ length: message.length }, (_, i) =>
    allEmpty[Math.floor(i * step)],
  )
  const reservedSet = new Set(hiddenMessageIndices)

  // Gap fill all non-reserved empty cells (message slots treated as off-limits)
  // Row scan first (fills horizontal spans cleanly), then exhaustive for isolated cells
  const bPlacedRow = fillGapsRowScan(grid, cols, rows, bList, rng, reservedSet, usedWords)
  const bPlacedEx = fillGapsExhaustively(grid, cols, rows, bList, rng, reservedSet, usedWords)
  placed.push(...bPlacedRow, ...bPlacedEx)

  // Check all non-reserved cells are now filled
  const unfilled = grid.filter((c, i) => c === '' && !reservedSet.has(i)).length
  if (unfilled > 0) {
    return {
      ok: false,
      error: {
        type: 'UNFILLABLE_CELLS',
        message: `${unfilled} cel(len) konden niet worden gevuld met woorden. Voeg meer B-woorden toe of vergroot het raster.`,
      },
    }
  }

  // Inject the hidden message into the reserved cells
  for (let i = 0; i < message.length; i++) {
    grid[hiddenMessageIndices[i]] = message[i]
  }

  return { ok: true, result: { grid, placed, cols, rows, hiddenMessageIndices } }
}
