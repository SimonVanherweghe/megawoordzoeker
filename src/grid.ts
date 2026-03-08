import type { Direction, GridConfig, GridDimensions, PlacedWord, GenerationOutcome, GenerationOptions } from './types.ts'

export function computeDimensions(config: GridConfig): GridDimensions {
  return {
    cols: Math.floor(config.widthCm / config.cellSizeCm),
    rows: Math.floor(config.heightCm / config.cellSizeCm),
  }
}

// Direction vectors: [dCol, dRow] for each of the 8 directions
const DIRECTION_VECTORS: [number, number][] = [
  [1, 0],   // 0: right
  [-1, 0],  // 1: left
  [0, 1],   // 2: down
  [0, -1],  // 3: up
  [1, 1],   // 4: down-right
  [-1, -1], // 5: up-left
  [1, -1],  // 6: up-right
  [-1, 1],  // 7: down-left
]

function canPlace(
  grid: string[],
  word: string,
  startIndex: number,
  direction: Direction,
  cols: number,
  rows: number,
): boolean {
  const [dc, dr] = DIRECTION_VECTORS[direction]
  const startCol = startIndex % cols
  const startRow = Math.floor(startIndex / cols)

  for (let i = 0; i < word.length; i++) {
    const col = startCol + dc * i
    const row = startRow + dr * i
    if (col < 0 || col >= cols || row < 0 || row >= rows) return false
    const idx = row * cols + col
    const existing = grid[idx]
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
  const positions = shuffle(
    Array.from({ length: size }, (_, i) => i),
    rng,
  )
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

export function generateGrid(options: GenerationOptions): GenerationOutcome {
  const { gridConfig, aList, bList, hiddenMessage } = options
  const { cols, rows } = computeDimensions(gridConfig)
  const size = cols * rows
  const grid: string[] = Array(size).fill('')

  // Simple seeded-ish RNG using Math.random (worker context, acceptable)
  const rng = Math.random

  // Sort both lists by length descending
  const sortedA = [...aList].sort((a, b) => b.length - a.length)
  const sortedB = [...bList].sort((a, b) => b.length - a.length)

  const placed: PlacedWord[] = []

  // Place A-list words first
  for (const word of sortedA) {
    const result = tryPlaceWord(grid, word.toUpperCase(), cols, rows, rng)
    if (result) {
      placeWord(grid, word.toUpperCase(), result.startIndex, result.direction, cols)
      placed.push({ word, startIndex: result.startIndex, direction: result.direction, isAList: true })
    }
  }

  // Fill gaps with B-list words
  for (const word of sortedB) {
    const result = tryPlaceWord(grid, word.toUpperCase(), cols, rows, rng)
    if (result) {
      placeWord(grid, word.toUpperCase(), result.startIndex, result.direction, cols)
      placed.push({ word, startIndex: result.startIndex, direction: result.direction, isAList: false })
    }
  }

  // Count empty cells
  const emptyCells = grid.reduce((acc, cell, i) => (cell === '' ? [...acc, i] : acc), [] as number[])
  const message = hiddenMessage.toUpperCase().replace(/[^A-Z]/g, '')

  if (emptyCells.length < message.length) {
    return {
      ok: false,
      error: {
        type: 'NOT_ENOUGH_CELLS',
        message: `Niet genoeg lege cellen voor het verborgen bericht. Vergroot het raster of verklein het bericht. (${emptyCells.length} cellen vrij, ${message.length} nodig)`,
      },
    }
  }

  // Inject hidden message left-to-right, top-to-bottom into empty cells
  for (let i = 0; i < message.length; i++) {
    grid[emptyCells[i]] = message[i]
  }

  // Fill remaining empty cells with random letters
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (let i = message.length; i < emptyCells.length; i++) {
    grid[emptyCells[i]] = ALPHABET[Math.floor(rng() * 26)]
  }

  return { ok: true, result: { grid, placed, cols, rows } }
}
