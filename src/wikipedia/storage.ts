import type { WordLists } from '../types.ts'

const STORAGE_KEY = 'megawoordzoeker_wordlists'

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

export function mergeWordLists(existing: WordLists, incoming: WordLists): WordLists {
  return {
    aList: [...new Set([...existing.aList, ...incoming.aList])],
    bList: [...new Set([...existing.bList, ...incoming.bList])],
  }
}
