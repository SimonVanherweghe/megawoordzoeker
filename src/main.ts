import { wrap } from 'comlink'
import type { GeneratorWorker } from './worker/generator.worker.ts'
import { GridRenderer } from './renderer/canvas.ts'
import { downloadSVG } from './renderer/svg.ts'
import { WordListPanel } from './ui/wordListPanel.ts'
import { extractWordLists } from './wikipedia/extractor.ts'
import { loadWordLists, saveWordLists, mergeWordLists } from './wikipedia/storage.ts'
import type { GridConfig, WordLists, GenerationOptions } from './types.ts'

// --- Worker setup ---
const workerInstance = new Worker(new URL('./worker/generator.worker.ts', import.meta.url), {
  type: 'module',
})
const generator = wrap<GeneratorWorker>(workerInstance)

// --- DOM refs ---
const wikiInput = document.getElementById('wikiInput') as HTMLInputElement
const wikiFetch = document.getElementById('wikiFetch') as HTMLButtonElement
const wikiStatus = document.getElementById('wikiStatus') as HTMLElement
const wordListContainer = document.getElementById('wordListContainer') as HTMLElement
const widthInput = document.getElementById('widthCm') as HTMLInputElement
const heightInput = document.getElementById('heightCm') as HTMLInputElement
const cellSizeInput = document.getElementById('cellSizeCm') as HTMLInputElement
const hiddenMsgInput = document.getElementById('hiddenMessage') as HTMLInputElement
const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement
const generateStatus = document.getElementById('generateStatus') as HTMLElement
const canvas = document.getElementById('gridCanvas') as HTMLCanvasElement
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement
const wordListEl = document.getElementById('aWordList') as HTMLElement

// --- State ---
let wordLists: WordLists = loadWordLists() ?? { aList: [], bList: [] }
let currentResult = null as import('./types.ts').GenerationResult | null

// --- Word list panel ---
const panel = new WordListPanel(wordListContainer, (lists) => {
  wordLists = lists
})
panel.setLists(wordLists)

// --- Canvas renderer ---
const renderer = new GridRenderer(canvas)

// Scroll support
canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  renderer.scroll(e.deltaX, e.deltaY)
}, { passive: false })

// --- Wikipedia fetch ---
wikiFetch.addEventListener('click', async () => {
  const title = wikiInput.value.trim()
  if (!title) return
  wikiFetch.disabled = true
  try {
    const incoming = await extractWordLists(title, {
      lang: 'nl',
      maxDepth: 3,
      targetAWords: 200,
      targetBWords: 100,
      onProgress: ({ articlesVisited, aWordsFound, bWordsFound, currentTitle }) => {
        wikiStatus.textContent =
          `Artikel ${articlesVisited}: "${currentTitle}" — ${aWordsFound} A-woorden, ${bWordsFound} B-woorden gevonden`
      },
    })
    const merged = mergeWordLists(wordLists, incoming)
    saveWordLists(merged)
    wordLists = merged
    panel.setLists(wordLists)
    wikiStatus.textContent = `Klaar! ${merged.aList.length} A-woorden, ${merged.bList.length} B-woorden.`
  } catch (e) {
    wikiStatus.textContent = `Fout: ${String(e)}`
  } finally {
    wikiFetch.disabled = false
  }
})

// --- Generate ---
generateBtn.addEventListener('click', async () => {
  const gridConfig: GridConfig = {
    widthCm: parseFloat(widthInput.value),
    heightCm: parseFloat(heightInput.value),
    cellSizeCm: parseFloat(cellSizeInput.value),
  }
  const options: GenerationOptions = {
    gridConfig,
    aList: wordLists.aList,
    bList: wordLists.bList,
    hiddenMessage: hiddenMsgInput.value,
  }

  generateBtn.disabled = true
  generateStatus.textContent = 'Genereren…'
  exportBtn.disabled = true

  const outcome = await generator.generate(options)

  generateBtn.disabled = false

  if (!outcome.ok) {
    generateStatus.textContent = outcome.error.message
    return
  }

  currentResult = outcome.result
  generateStatus.textContent = `Klaar! ${outcome.result.placed.filter((p) => p.isAList).length} A-woorden geplaatst.`
  renderer.setResult(outcome.result)
  exportBtn.disabled = false

  // Render A-word list for the solver
  const aWords = outcome.result.placed.filter((p) => p.isAList).map((p) => p.word)
  wordListEl.innerHTML = aWords
    .sort()
    .map((w) => `<li>${w.toUpperCase()}</li>`)
    .join('')
})

// --- Export ---
exportBtn.addEventListener('click', () => {
  if (currentResult) downloadSVG(currentResult)
})
