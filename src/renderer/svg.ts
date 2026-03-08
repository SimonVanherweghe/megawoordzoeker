import type { GenerationResult } from '../types.ts'

const CELL_SIZE_MM = 25 // 1 cell = 25mm in the SVG output
const FONT_SIZE_MM = 14
const STROKE_WIDTH = 0.3

export function generateSVG(result: GenerationResult, cellSizeMm = CELL_SIZE_MM): string {
  const { grid, cols, rows } = result
  const width = cols * cellSizeMm
  const height = rows * cellSizeMm

  const lines: string[] = []

  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="white"/>`,
    `<g font-family="monospace" font-size="${FONT_SIZE_MM}" text-anchor="middle" dominant-baseline="central" fill="#111">`,
  )

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col
      const x = col * cellSizeMm
      const y = row * cellSizeMm
      const cx = x + cellSizeMm / 2
      const cy = y + cellSizeMm / 2
      const letter = grid[idx] ?? ''

      // Cell border
      lines.push(
        `<rect x="${x}" y="${y}" width="${cellSizeMm}" height="${cellSizeMm}" fill="none" stroke="#ccc" stroke-width="${STROKE_WIDTH}"/>`,
      )

      // Letter
      if (letter) {
        lines.push(`<text x="${cx}" y="${cy}">${escapeXML(letter)}</text>`)
      }
    }
  }

  lines.push('</g>', '</svg>')

  return lines.join('\n')
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function downloadSVG(result: GenerationResult, filename = 'woordzoeker.svg'): void {
  const svg = generateSVG(result)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
