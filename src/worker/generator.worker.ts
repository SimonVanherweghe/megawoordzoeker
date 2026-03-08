import { expose } from 'comlink'
import { generateGrid } from '../grid.ts'
import type { GenerationOptions, GenerationOutcome } from '../types.ts'

const api = {
  generate(options: GenerationOptions): GenerationOutcome {
    return generateGrid(options)
  },
}

expose(api)
export type GeneratorWorker = typeof api
