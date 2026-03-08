import type { WordLists, GenerationResult } from '../types.ts'
import { filterSimilarWords } from './extractor.ts'

const STORAGE_KEY = 'megawoordzoeker_wordlists'
const RESULT_KEY  = 'megawoordzoeker_result'

export function saveWordLists(lists: WordLists): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists))
}

export function loadWordLists(): WordLists | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as WordLists
  } catch {
    return null
  }
}

export function clearWordLists(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function saveGenerationResult(result: GenerationResult): void {
  localStorage.setItem(RESULT_KEY, JSON.stringify(result))
}

export function loadGenerationResult(): GenerationResult | null {
  const raw = localStorage.getItem(RESULT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as GenerationResult
  } catch {
    return null
  }
}

export function mergeWordLists(existing: WordLists, incoming: WordLists): WordLists {
  return {
    aList: filterSimilarWords([...new Set([...existing.aList, ...incoming.aList])]),
    bList: [...new Set([...existing.bList, ...incoming.bList])],
  }
}
