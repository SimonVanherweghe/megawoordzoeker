import { DUTCH_STOP_WORDS } from './stopwords.ts'
import type { WikiFetchOptions, WordLists } from '../types.ts'

const A_LIST_MIN = 6
const B_LIST_MIN = 3

// How many links to queue per article — limits fanout aggressively
const MAX_LINKS_PER_ARTICLE = 10

interface WikiQueryResponse {
  query: {
    pages: Record<string, {
      title: string
      extract?: string
      links?: { title: string }[]
    }>
  }
}

async function fetchArticle(
  title: string,
  lang: string,
): Promise<{ text: string; links: string[] }> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`)
  url.searchParams.set('action', 'query')
  url.searchParams.set('titles', title)
  url.searchParams.set('prop', 'extracts|links')
  url.searchParams.set('explaintext', '1')
  url.searchParams.set('pllimit', '50')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')

  const res = await fetch(url.toString())
  const data: WikiQueryResponse = await res.json()
  const page = Object.values(data.query.pages)[0]

  return {
    text: page.extract ?? '',
    links: (page.links ?? []).map((l) => l.title),
  }
}

/**
 * Removes A-list words that are a prefix of another word in the same list.
 * e.g. "mens" is removed when "mensen" is also present.
 * The longer, more distinctive word is kept.
 */
export function filterSimilarWords(words: string[]): string[] {
  const lower = words.map((w) => w.toLowerCase())
  const remove = new Set<number>()

  for (let i = 0; i < lower.length; i++) {
    if (remove.has(i)) continue
    for (let j = 0; j < lower.length; j++) {
      if (i === j || remove.has(j)) continue
      if (lower[j].startsWith(lower[i]) && lower[j] !== lower[i]) {
        remove.add(i)
        break
      }
    }
  }

  return words.filter((_, i) => !remove.has(i))
}

export function sanitizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')       // strip HTML
    .replace(/[^a-zà-ÿ\s]/gi, ' ') // strip punctuation, numbers
    .split(/\s+/)
    .filter((w) => {
      if (w.length < B_LIST_MIN) return false
      if (DUTCH_STOP_WORDS.has(w)) return false
      if (/[^a-zà-ÿ]/i.test(w)) return false
      return true
    })
}

export async function extractWordLists(
  startTitle: string,
  options: WikiFetchOptions = {},
): Promise<WordLists> {
  const lang = options.lang ?? 'nl'
  const maxDepth = options.maxDepth ?? 3
  const targetAWords = options.targetAWords ?? 200
  const targetBWords = options.targetBWords ?? 100
  const onProgress = options.onProgress

  const visited = new Set<string>()
  const aWords = new Set<string>()
  const bWords = new Set<string>()

  // BFS queue: [title, depth]
  const queue: [string, number][] = [[startTitle, 0]]

  while (queue.length > 0) {
    // Stop early once we have enough words
    if (aWords.size >= targetAWords && bWords.size >= targetBWords) break

    const [title, depth] = queue.shift()!
    if (visited.has(title)) continue
    visited.add(title)

    onProgress?.({
      articlesVisited: visited.size,
      aWordsFound: aWords.size,
      bWordsFound: bWords.size,
      currentTitle: title,
    })

    let article: { text: string; links: string[] }
    try {
      article = await fetchArticle(title, lang)
    } catch {
      continue
    }

    for (const word of sanitizeText(article.text)) {
      if (word.length >= A_LIST_MIN) aWords.add(word)
      else bWords.add(word)
    }

    // Only go deeper if we still need more A-words, and haven't hit max depth
    if (depth < maxDepth && aWords.size < targetAWords) {
      const links = article.links.slice(0, MAX_LINKS_PER_ARTICLE)
      for (const link of links) {
        if (!visited.has(link)) {
          queue.push([link, depth + 1])
        }
      }
    }
  }

  return {
    aList: filterSimilarWords([...aWords]),
    bList: [...bWords],
  }
}
