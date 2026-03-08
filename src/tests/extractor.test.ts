import { describe, it, expect, vi, afterEach } from 'vitest'
import { sanitizeText, extractWordLists } from '../wikipedia/extractor.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sanitizeText', () => {
  it('strips HTML tags', () => {
    const result = sanitizeText('<b>Nederland</b> is een land')
    expect(result).toContain('nederland')
    expect(result.join(' ')).not.toContain('<b>')
  })

  it('removes punctuation and numbers', () => {
    const result = sanitizeText('Amsterdam, 1234 steden!')
    expect(result.join(' ')).not.toMatch(/[0-9.,!]/)
  })

  it('filters out Dutch stop words', () => {
    const result = sanitizeText('de het een en van')
    expect(result).toHaveLength(0)
  })

  it('filters words shorter than 3 characters', () => {
    const result = sanitizeText('ik de ab')
    expect(result.every((w) => w.length >= 3)).toBe(true)
  })

  it('returns lowercase words', () => {
    const result = sanitizeText('Nederland Amsterdam Rotterdam')
    expect(result.every((w) => w === w.toLowerCase())).toBe(true)
  })
})

describe('extractWordLists', () => {
  it('splits words into A-list (≥6) and B-list (3–5)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({
        query: {
          pages: {
            '1': {
              title: 'Test',
              extract: 'fiets water Nederland Amsterdam school boot',
              links: [],
            },
          },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const lists = await extractWordLists('Test', { lang: 'nl', maxDepth: 0 })

    // 'fiets' (5) → B, 'water' (5) → B, 'nederland' (9) → A, 'amsterdam' (9) → A, 'school' (6) → A, 'boot' (4) → B
    expect(lists.aList).toContain('nederland')
    expect(lists.aList).toContain('amsterdam')
    expect(lists.aList).toContain('school')
    expect(lists.bList).toContain('fiets')
    expect(lists.bList).toContain('water')
    expect(lists.bList).toContain('boot')
  })

  it('crawls linked articles up to maxDepth', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          query: {
            pages: {
              '1': {
                title: 'Hoofdartikel',
                extract: 'hoofdartikel tekst hier',
                links: [{ title: 'Subartikel' }],
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          query: {
            pages: {
              '2': {
                title: 'Subartikel',
                extract: 'subartikel woorden gevonden',
                links: [],
              },
            },
          },
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    await extractWordLists('Hoofdartikel', { lang: 'nl', maxDepth: 1 })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not follow links beyond maxDepth', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({
        query: {
          pages: {
            '1': {
              title: 'Artikel',
              extract: 'tekst',
              links: [{ title: 'Link1' }, { title: 'Link2' }],
            },
          },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await extractWordLists('Artikel', { lang: 'nl', maxDepth: 0 })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('deduplicates words across articles', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({
        query: {
          pages: {
            '1': {
              title: 'Test',
              extract: 'nederland nederland nederland',
              links: [],
            },
          },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const lists = await extractWordLists('Test', { lang: 'nl', maxDepth: 0 })
    const count = lists.aList.filter((w) => w === 'nederland').length
    expect(count).toBe(1)
  })
})
