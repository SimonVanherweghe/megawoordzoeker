import type { GenerationResult } from '../types.ts'

const CELL_PX = 24 // pixels per cell in the canvas preview
const FONT_SIZE = 14
const FONT = `${FONT_SIZE}px monospace`
const TEXT_COLOR = '#111111'
const GRID_COLOR = '#cccccc'
const BG_COLOR = '#ffffff'
const HIGHLIGHT_COLOR = 'rgba(255, 220, 0, 0.4)'

export class GridRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private result: GenerationResult | null = null
  private scrollX = 0
  private scrollY = 0
  private highlightSet = new Set<number>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  setResult(result: GenerationResult): void {
    this.result = result
    this.scrollX = 0
    this.scrollY = 0
    this.canvas.width = Math.min(result.cols * CELL_PX, window.innerWidth - 40)
    this.canvas.height = Math.min(result.rows * CELL_PX, window.innerHeight - 200)
    this.draw()
  }

  setHighlight(indices: Set<number>): void {
    this.highlightSet = indices
    this.draw()
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

        if (this.highlightSet.has(idx)) {
          ctx.fillStyle = HIGHLIGHT_COLOR
          ctx.fillRect(x, y, CELL_PX, CELL_PX)
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
