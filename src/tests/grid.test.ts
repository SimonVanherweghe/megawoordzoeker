import { describe, it, expect } from 'vitest'
import { generateGrid, computeDimensions } from '../grid.ts'
import type { GenerationOptions } from '../types.ts'

const BASE_CONFIG = { widthCm: 30, heightCm: 30, cellSizeCm: 2.5 } // 12x12 = 144 cells
// Larger grid for tests that require full coverage (isolated cells much less likely)
const FILL_CONFIG = { widthCm: 75, heightCm: 75, cellSizeCm: 2.5 } // 30x30 = 900 cells

// A diverse set of B-words with varied letters so the gap fill can cover any cell
const B_FILL: string[] = [
  'bad', 'bak', 'bal', 'ban', 'bar', 'bas', 'bat',
  'dak', 'dam', 'dan', 'das', 'dat', 'dek',
  'eer', 'elk', 'erg', 'ers',
  'fax', 'fin', 'fit',
  'gas', 'gat', 'gek', 'gel', 'gem', 'god',
  'hal', 'ham', 'has', 'hat', 'hek', 'hem',
  'ijs', 'ink',
  'jam', 'jan', 'jas',
  'kap', 'kar', 'kas', 'kat', 'kel', 'kem', 'ken', 'kep',
  'lam', 'lap', 'las', 'lat', 'leg', 'lek', 'les', 'let',
  'mal', 'man', 'mar', 'mas', 'mat', 'mel', 'men', 'mes',
  'nak', 'nal', 'nam', 'nat', 'nel', 'nem', 'nes', 'net',
  'pal', 'pan', 'par', 'pas', 'pat', 'pel', 'pen', 'per', 'pet',
  'rad', 'rag', 'rak', 'ram', 'rap', 'ras', 'rat', 'reg', 'rem', 'rep', 'res', 'ret',
  'sal', 'san', 'sap', 'sar', 'sat', 'sel', 'sen', 'ser', 'set',
  'tak', 'tal', 'tam', 'tan', 'tap', 'tar', 'tas', 'tat', 'tel', 'ten', 'ter', 'tes',
  'val', 'van', 'var', 'vas', 'vel', 'ven', 'ver', 'vet',
  'wal', 'wan', 'war', 'was', 'wat', 'wel', 'wen', 'wer', 'wet',
  'zak', 'zal', 'zam', 'zan', 'zap', 'zar', 'zat', 'zel', 'zen', 'zet',
]

function makeOptions(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  return {
    gridConfig: BASE_CONFIG,
    aList: [],
    bList: B_FILL,
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
    const outcome = generateGrid(makeOptions({ aList: ['HALLO', 'AARDE'] }))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const aWords = outcome.result.placed.filter((p) => p.isAList)
    expect(aWords.length).toBe(2)
  })

  it('grid cells at placed word positions contain the correct letters', () => {
    const outcome = generateGrid(makeOptions({ aList: ['KAAS', 'ADEM'] }))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    const { grid, cols, placed } = outcome.result
    for (const pw of placed.filter((p) => p.isAList)) {
      const [dc, dr] = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]][pw.direction]
      const startCol = pw.startIndex % cols
      const startRow = Math.floor(pw.startIndex / cols)
      for (let i = 0; i < pw.word.length; i++) {
        const idx = (startRow + dr * i) * cols + (startCol + dc * i)
        expect(grid[idx]).toBe(pw.word[i].toUpperCase())
      }
    }
  })

  it('grid is fully filled — no empty cells and no random filler', () => {
    const outcome = generateGrid(makeOptions({ aList: ['NEDERLAND', 'AMSTERDAM'], gridConfig: FILL_CONFIG }))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.grid.every((c) => c !== '')).toBe(true)
  })
})

describe('hidden message injection', () => {
  it('hiddenMessageIndices spell out the message in the grid', () => {
    const hiddenMessage = 'HALLO'
    const outcome = generateGrid(makeOptions({ hiddenMessage, gridConfig: FILL_CONFIG }))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    const { grid, hiddenMessageIndices } = outcome.result
    const recovered = hiddenMessageIndices.map((i) => grid[i]).join('')
    expect(recovered).toBe('HALLO')
  })

  it('hidden message indices are in strictly ascending order (left-to-right, top-to-bottom)', () => {
    const outcome = generateGrid(makeOptions({ hiddenMessage: 'TESTBERICHT', gridConfig: FILL_CONFIG }))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    const { hiddenMessageIndices } = outcome.result
    for (let i = 1; i < hiddenMessageIndices.length; i++) {
      expect(hiddenMessageIndices[i]).toBeGreaterThan(hiddenMessageIndices[i - 1])
    }
  })

  it('grid is completely filled after message injection and gap fill', () => {
    const outcome = generateGrid(makeOptions({ hiddenMessage: 'GEFELICITAARD', gridConfig: FILL_CONFIG }))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.grid.every((c) => c !== '')).toBe(true)
  })

  it('returns NOT_ENOUGH_CELLS error when message is longer than empty cells', () => {
    // 2x2 = 4 cells — no 3-letter word fits, so all 4 cells are empty before message
    const tinyConfig = { widthCm: 5, heightCm: 5, cellSizeCm: 2.5 }
    const outcome = generateGrid(makeOptions({
      hiddenMessage: 'DEZEBERICHTISTELANNG',
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
