import { describe, it, expect } from 'vitest'
import { generateGrid, computeDimensions } from '../grid.ts'
import type { GenerationOptions } from '../types.ts'

const BASE_CONFIG = { widthCm: 30, heightCm: 30, cellSizeCm: 2.5 } // 12x12 grid

function makeOptions(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  return {
    gridConfig: BASE_CONFIG,
    aList: [],
    bList: [],
    hiddenMessage: '',
    ...overrides,
  }
}

describe('computeDimensions', () => {
  it('computes cols and rows from cm values', () => {
    expect(computeDimensions({ widthCm: 90, heightCm: 200, cellSizeCm: 2.5 })).toEqual({
      cols: 36,
      rows: 80,
    })
  })

  it('floors partial cells', () => {
    expect(computeDimensions({ widthCm: 91, heightCm: 201, cellSizeCm: 2.5 })).toEqual({
      cols: 36,
      rows: 80,
    })
  })
})

describe('grid collision detection', () => {
  it('places a single word successfully', () => {
    const outcome = generateGrid(makeOptions({ aList: ['HALLO'] }))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const placed = outcome.result.placed.find((p) => p.word === 'HALLO')
    expect(placed).toBeDefined()
  })

  it('allows two words that share an identical crossing letter', () => {
    // HALLO and AARDE share the letter A
    const outcome = generateGrid(makeOptions({ aList: ['HALLO', 'AARDE'] }))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.placed.length).toBe(2)
  })

  it('grid cells at intersections contain the shared letter', () => {
    // Force a known configuration: small grid, two words known to share a letter
    const outcome = generateGrid(
      makeOptions({ aList: ['KAAS', 'ADEM'], gridConfig: { widthCm: 25, heightCm: 25, cellSizeCm: 2.5 } }),
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    const { grid, cols, placed } = outcome.result
    for (const pw of placed) {
      // Verify each letter of each placed word is in the grid
      const [dc, dr] = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]][pw.direction]
      const startCol = pw.startIndex % cols
      const startRow = Math.floor(pw.startIndex / cols)
      for (let i = 0; i < pw.word.length; i++) {
        const col = startCol + dc * i
        const row = startRow + dr * i
        const idx = row * cols + col
        expect(grid[idx]).toBe(pw.word[i].toUpperCase())
      }
    }
  })
})

describe('hidden message injection', () => {
  it('injects message characters into empty cells left-to-right, top-to-bottom', () => {
    const hiddenMessage = 'HALLO'
    const outcome = generateGrid(makeOptions({ hiddenMessage, aList: [] }))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    const { grid } = outcome.result
    // The first 5 non-empty cells (in order) should spell HALLO
    const letters = grid.slice(0, 5).join('')
    expect(letters).toBe('HALLO')
  })

  it('injects message sequentially into the first empty slots', () => {
    const hiddenMessage = 'TEST'
    const outcome = generateGrid(makeOptions({ hiddenMessage, aList: [] }))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    const { grid } = outcome.result
    expect(grid.slice(0, 4).join('')).toBe('TEST')
  })

  it('returns NOT_ENOUGH_CELLS error when message is longer than empty cells', () => {
    const tinyConfig = { widthCm: 5, heightCm: 5, cellSizeCm: 2.5 } // 2x2 = 4 cells
    const outcome = generateGrid(makeOptions({
      hiddenMessage: 'DEZEBERICHTISTELANNG',
      aList: [],
      gridConfig: tinyConfig,
    }))
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.type).toBe('NOT_ENOUGH_CELLS')
  })
})

describe('word list sorting', () => {
  it('places all given words when grid is large enough', () => {
    const words = ['NEDERLAND', 'FIETS', 'BOOM', 'WATER', 'SCHOOL']
    const outcome = generateGrid(
      makeOptions({
        aList: words,
        gridConfig: { widthCm: 100, heightCm: 100, cellSizeCm: 2.5 },
      }),
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const placedWords = outcome.result.placed.map((p) => p.word.toUpperCase())
    for (const w of words) {
      expect(placedWords).toContain(w.toUpperCase())
    }
  })
})
