import type { GenerationResult } from '../types.ts'

export const CELL_PX = 24
const FONT_SIZE = 14
const FONT = `${FONT_SIZE}px monospace`
const TEXT_COLOR = '#111111'
const GRID_COLOR = '#cccccc'
const BG_COLOR = '#ffffff'

// Named highlight layers rendered bottom-to-top
const HIGHLIGHT_LAYERS = ['message', 'bword', 'word'] as const
type HighlightLayer = typeof HIGHLIGHT_LAYERS[number]

const LAYER_COLORS: Record<HighlightLayer, string> = {
  message: 'rgba(52, 211, 153, 0.55)',   // teal
  bword:   'rgba(147, 197, 253, 0.65)',   // light blue
  word:    'rgba(251, 191, 36, 0.6)',     // amber
}

export class GridRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private result: GenerationResult | null = null
  private scrollX = 0
  private scrollY = 0
  private highlights = new Map<HighlightLayer, Set<number>>()
  // Coverage map: cell index → fill color string (null = off)
  private coverageMap: Map<number, string> | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  setResult(result: GenerationResult): void {
    this.result = result
    this.scrollX = 0
    this.scrollY = 0
    this.highlights.clear()
    this.coverageMap = null
    this.canvas.width = Math.min(result.cols * CELL_PX, window.innerWidth - 40)
    this.canvas.height = Math.min(result.rows * CELL_PX, window.innerHeight - 200)
    this.draw()
  }

  setHighlight(layer: HighlightLayer, indices: Set<number>): void {
    this.highlights.set(layer, indices)
    this.draw()
  }

  clearHighlight(layer: HighlightLayer): void {
    this.highlights.delete(layer)
    this.draw()
  }

  setCoverageMap(map: Map<number, string> | null): void {
    this.coverageMap = map
    this.draw()
  }

  /** Returns the grid cell index under canvas pixel (x, y), or -1 if out of bounds. */
  getCellAt(canvasX: number, canvasY: number): number {
    if (!this.result) return -1
    const col = Math.floor((canvasX + this.scrollX) / CELL_PX)
    const row = Math.floor((canvasY + this.scrollY) / CELL_PX)
    if (col < 0 || col >= this.result.cols || row < 0 || row >= this.result.rows) return -1
    return row * this.result.cols + col
  }

  scroll(dx: number, dy: number): void {
    if (!this.result) return
    const maxX = Math.max(0, this.result.cols * CELL_PX - this.canvas.width)
    const maxY = Math.max(0, this.result.rows * CELL_PX - this.canvas.height)
    this.scrollX = Math.max(0, Math.min(maxX, this.scrollX + dx))
    this.scrollY = Math.max(0, Math.min(maxY, this.scrollY + dy))
    this.draw()
  }

  draw(): void {
    if (!this.result) return
    const { grid, cols, rows } = this.result
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, w, h)

    const startCol = Math.floor(this.scrollX / CELL_PX)
    const startRow = Math.floor(this.scrollY / CELL_PX)
    const endCol = Math.min(cols, startCol + Math.ceil(w / CELL_PX) + 1)
    const endRow = Math.min(rows, startRow + Math.ceil(h / CELL_PX) + 1)

    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const idx = row * cols + col
        const x = col * CELL_PX - this.scrollX
        const y = row * CELL_PX - this.scrollY

        // Coverage map (bottom layer)
        const coverageColor = this.coverageMap?.get(idx)
        if (coverageColor) {
          ctx.fillStyle = coverageColor
          ctx.fillRect(x, y, CELL_PX, CELL_PX)
        }

        // Named highlight layers
        for (const layer of HIGHLIGHT_LAYERS) {
          if (this.highlights.get(layer)?.has(idx)) {
            ctx.fillStyle = LAYER_COLORS[layer]
            ctx.fillRect(x, y, CELL_PX, CELL_PX)
          }
        }

        // Grid lines
        ctx.strokeStyle = GRID_COLOR
        ctx.lineWidth = 0.5
        ctx.strokeRect(x, y, CELL_PX, CELL_PX)

        // Letter
        ctx.fillStyle = TEXT_COLOR
        ctx.fillText(grid[idx] ?? '', x + CELL_PX / 2, y + CELL_PX / 2)
      }
    }
  }
}
