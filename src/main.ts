import { wrap } from 'comlink'
import type { GeneratorWorker } from './worker/generator.worker.ts'
import { GridRenderer } from './renderer/canvas.ts'
import { downloadSVG } from './renderer/svg.ts'
import { WordListPanel } from './ui/wordListPanel.ts'
import { extractWordLists } from './wikipedia/extractor.ts'
import { loadWordLists, saveWordLists, mergeWordLists, saveGenerationResult, loadGenerationResult } from './wikipedia/storage.ts'
import { getWordCells } from './grid.ts'
import type { GridConfig, WordLists, GenerationOptions, PlacedWord } from './types.ts'

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
const showMsgBtn = document.getElementById('showMsgBtn') as HTMLButtonElement
const coverageBtn = document.getElementById('coverageBtn') as HTMLButtonElement
const wordList = document.getElementById('wordList') as HTMLElement
const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement

// --- State ---
let wordLists: WordLists = loadWordLists() ?? { aList: [], bList: [] }
let currentResult = null as import('./types.ts').GenerationResult | null

// Lookup structures rebuilt after each generation
let aPlaced: PlacedWord[] = []
let bPlaced: PlacedWord[] = []
let aWordCells: number[][] = []          // aPlaced index → cell indices
let bWordCells: number[][] = []          // bPlaced index → cell indices
let cellToAIdx = new Map<number, number[]>()
let cellToBIdx = new Map<number, number[]>()

let showingMessage = false
let showingCoverage = false

// Coverage colors
const COV_A       = 'rgba(253, 224, 71, 0.35)'   // soft amber  — A-list words
const COV_B       = 'rgba(147, 197, 253, 0.45)'   // soft blue   — B-list words
const COV_MSG     = 'rgba(52, 211, 153, 0.45)'    // soft teal   — hidden message
const COV_FILLER  = 'rgba(200, 200, 200, 0.35)'   // soft gray   — random filler

// --- Word list panel ---
const panel = new WordListPanel(wordListContainer, (lists) => {
  wordLists = lists
})
panel.setLists(wordLists)

// --- Canvas renderer ---
const renderer = new GridRenderer(canvas)

// Restore last generated result on startup
const savedResult = loadGenerationResult()
if (savedResult) applyResult(savedResult)

canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  renderer.scroll(e.deltaX, e.deltaY)
}, { passive: false })

// Canvas hover → highlight word(s) + activate list items
canvas.addEventListener('mousemove', (e) => {
  if (!currentResult) return
  const rect = canvas.getBoundingClientRect()
  const cellIdx = renderer.getCellAt(e.clientX - rect.left, e.clientY - rect.top)

  const aIndices = cellToAIdx.get(cellIdx) ?? []
  const bIndices = cellToBIdx.get(cellIdx) ?? []

  if (aIndices.length > 0) {
    renderer.setHighlight('word', new Set(aIndices.flatMap((i) => aWordCells[i])))
  } else {
    renderer.clearHighlight('word')
  }

  if (bIndices.length > 0) {
    renderer.setHighlight('bword', new Set(bIndices.flatMap((i) => bWordCells[i])))
  } else {
    renderer.clearHighlight('bword')
  }

  setActiveItems(aIndices, bIndices)
})

canvas.addEventListener('mouseleave', () => {
  renderer.clearHighlight('word')
  renderer.clearHighlight('bword')
  setActiveItems([], [])
})

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
    wikiInput.value = ''
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
  showMsgBtn.disabled = true
  coverageBtn.disabled = true
  showingMessage = false
  showingCoverage = false

  const outcome = await generator.generate(options)
  generateBtn.disabled = false

  if (!outcome.ok) {
    generateStatus.textContent = `⚠️ ${outcome.error.message}`
    return
  }

  saveGenerationResult(outcome.result)
  applyResult(outcome.result)
})

// --- Hidden message toggle ---
showMsgBtn.addEventListener('click', () => {
  if (!currentResult) return
  showingMessage = !showingMessage
  if (showingMessage) {
    renderer.setHighlight('message', new Set(currentResult.hiddenMessageIndices))
    showMsgBtn.textContent = 'Verberg bericht'
  } else {
    renderer.clearHighlight('message')
    showMsgBtn.textContent = 'Toon verborgen bericht'
  }
})

// --- Coverage map toggle ---
coverageBtn.addEventListener('click', () => {
  if (!currentResult) return
  showingCoverage = !showingCoverage
  if (showingCoverage) {
    const map = (canvas as unknown as { _coverageMap: Map<number, string> })._coverageMap
    renderer.setCoverageMap(map)
    coverageBtn.textContent = 'Verberg dekking'
  } else {
    renderer.setCoverageMap(null)
    coverageBtn.textContent = 'Toon celdekking'
  }
})

// --- Export ---
exportBtn.addEventListener('click', () => {
  if (currentResult) downloadSVG(currentResult)
})

// --- Copy word list ---
copyBtn.addEventListener('click', async () => {
  const words = [...wordList.querySelectorAll('li')].map((li) => li.textContent ?? '').join('\n')
  await navigator.clipboard.writeText(words)
  const original = copyBtn.textContent
  copyBtn.textContent = 'Gekopieerd!'
  setTimeout(() => { copyBtn.textContent = original }, 1500)
})

// --- Apply result (generate + restore) ---
function applyResult(result: import('./types.ts').GenerationResult): void {
  currentResult = result
  const { placed, cols, hiddenMessageIndices } = result

  aPlaced = placed.filter((p) => p.isAList)
  bPlaced = placed.filter((p) => !p.isAList)
  aWordCells = aPlaced.map((pw) => getWordCells(pw, cols))
  bWordCells = bPlaced.map((pw) => getWordCells(pw, cols))

  cellToAIdx = buildCellMap(aWordCells)

  const msgSet = new Set(hiddenMessageIndices)
  const aSet = new Set(aWordCells.flat())
  const bSet = new Set(bWordCells.flat())

  cellToBIdx = buildCellMap(bWordCells, aSet)

  const coverageMap = new Map<number, string>()
  for (let i = 0; i < result.grid.length; i++) {
    if (aSet.has(i))        coverageMap.set(i, COV_A)
    else if (bSet.has(i))   coverageMap.set(i, COV_B)
    else if (msgSet.has(i)) coverageMap.set(i, COV_MSG)
    else                    coverageMap.set(i, COV_FILLER)
  }

  const aCount = aPlaced.length
  const aTotal = wordLists.aList.length
  generateStatus.textContent = `Klaar! ${aCount}/${aTotal} A-woorden geplaatst.`

  renderer.setResult(result)
  canvas.dataset['hasCoverage'] = '1'
  ;(canvas as unknown as { _coverageMap: Map<number, string> })._coverageMap = coverageMap

  exportBtn.disabled = false
  showMsgBtn.disabled = result.hiddenMessageIndices.length === 0
  coverageBtn.disabled = false

  renderWordList()
}

// --- Helpers ---
function buildCellMap(cellLists: number[][], exclude?: Set<number>): Map<number, number[]> {
  const map = new Map<number, number[]>()
  cellLists.forEach((cells, i) => {
    for (const c of cells) {
      if (exclude?.has(c)) continue
      const existing = map.get(c)
      if (existing) existing.push(i)
      else map.set(c, [i])
    }
  })
  return map
}

function renderWordList(): void {
  const aItems = aPlaced.map((pw, i) => ({ word: pw.word.toUpperCase(), kind: 'a', idx: i }))
  const bItems = bPlaced.map((pw, i) => ({ word: pw.word.toUpperCase(), kind: 'b', idx: i }))
  const all = [...aItems, ...bItems].sort((x, y) => x.word.localeCompare(y.word))

  wordList.innerHTML = all
    .map((item) => `<li data-kind="${item.kind}" data-idx="${item.idx}">${item.word}</li>`)
    .join('')

  wordList.querySelectorAll('li').forEach((li) => {
    const kind = li.dataset['kind']!
    const idx = parseInt(li.dataset['idx']!)
    li.addEventListener('mouseenter', () => {
      if (kind === 'a') {
        renderer.setHighlight('word', new Set(aWordCells[idx]))
        setActiveItems([idx], [])
      } else {
        renderer.setHighlight('bword', new Set(bWordCells[idx]))
        setActiveItems([], [idx])
      }
    })
    li.addEventListener('mouseleave', () => {
      renderer.clearHighlight(kind === 'a' ? 'word' : 'bword')
      setActiveItems([], [])
    })
  })
}

function setActiveItems(aIndices: number[], bIndices: number[]): void {
  const activeA = new Set(aIndices)
  const activeB = new Set(bIndices)
  wordList.querySelectorAll('li').forEach((li) => {
    const kind = li.dataset['kind']!
    const idx = parseInt(li.dataset['idx']!)
    li.classList.toggle('word-active', kind === 'a' && activeA.has(idx))
    li.classList.toggle('bword-active', kind === 'b' && activeB.has(idx))
  })
}
