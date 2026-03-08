import type { WordLists } from '../types.ts'
import { saveWordLists, clearWordLists } from '../wikipedia/storage.ts'

export class WordListPanel {
  private container: HTMLElement
  private lists: WordLists = { aList: [], bList: [] }
  private onChange: (lists: WordLists) => void

  constructor(container: HTMLElement, onChange: (lists: WordLists) => void) {
    this.container = container
    this.onChange = onChange
  }

  setLists(lists: WordLists): void {
    this.lists = {
      aList: [...lists.aList],
      bList: [...lists.bList],
    }
    this.render()
  }

  getLists(): WordLists {
    return this.lists
  }

  private render(): void {
    const { aList, bList } = this.lists
    this.container.innerHTML = `
      <div class="word-list-panel">
        <div class="list-section">
          <h3>A-lijst (≥6 letters, ${aList.length} woorden)</h3>
          <textarea id="aList" rows="8">${[...aList].sort().join('\n')}</textarea>
        </div>
        <div class="list-section">
          <h3>B-lijst (3–5 letters, ${bList.length} woorden)</h3>
          <textarea id="bList" rows="8">${[...bList].sort().join('\n')}</textarea>
        </div>
        <div class="list-actions">
          <button id="saveWords">Opslaan</button>
          <button id="clearWords">Wissen</button>
        </div>
      </div>
    `

    this.container.querySelector('#saveWords')!.addEventListener('click', () => {
      this.readFromTextareas()
      saveWordLists(this.lists)
      this.onChange(this.lists)
    })

    this.container.querySelector('#clearWords')!.addEventListener('click', () => {
      this.lists = { aList: [], bList: [] }
      clearWordLists()
      this.render()
      this.onChange(this.lists)
    })
  }

  private readFromTextareas(): void {
    const aText = (this.container.querySelector('#aList') as HTMLTextAreaElement).value
    const bText = (this.container.querySelector('#bList') as HTMLTextAreaElement).value
    this.lists = {
      aList: aText.split('\n').map((w) => w.trim()).filter(Boolean),
      bList: bText.split('\n').map((w) => w.trim()).filter(Boolean),
    }
  }
}
