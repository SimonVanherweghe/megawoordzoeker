export type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface GridConfig {
  widthCm: number
  heightCm: number
  cellSizeCm: number
}

export interface GridDimensions {
  cols: number
  rows: number
}

export interface PlacedWord {
  word: string
  startIndex: number
  direction: Direction
  isAList: boolean
}

export interface GenerationResult {
  grid: string[]
  placed: PlacedWord[]
  cols: number
  rows: number
  hiddenMessageIndices: number[]
}

export interface GenerationOptions {
  gridConfig: GridConfig
  aList: string[]
  bList: string[]
  hiddenMessage: string
}

export interface GenerationError {
  type: 'NOT_ENOUGH_CELLS' | 'UNFILLABLE_CELLS'
  message: string
}

export type GenerationOutcome =
  | { ok: true; result: GenerationResult }
  | { ok: false; error: GenerationError }

export interface WordLists {
  aList: string[]
  bList: string[]
}

export interface WikiFetchProgress {
  articlesVisited: number
  aWordsFound: number
  bWordsFound: number
  currentTitle: string
}

export interface WikiFetchOptions {
  lang?: string
  maxDepth?: number
  targetAWords?: number
  targetBWords?: number
  onProgress?: (progress: WikiFetchProgress) => void
}
