import { beforeEach, describe, expect, it, vi } from 'vitest'
import { newDraft } from './draft'

// Minimal in-memory localStorage: Vitest runs in Node, which has none by default.
function stubStorage() {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  })
  return data
}

// Fresh module per test: the store keeps module-level state.
async function loadStore() {
  vi.resetModules()
  return import('./draftStore')
}

describe('draftStore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("does not show user A's draft to user B, and gives it back to A", async () => {
    stubStorage()
    const store = await loadStore()

    store.setDraftOwner('user-a')
    const draftA = newDraft({ name: 'A push day' })
    store.setDraft(draftA)

    store.setDraftOwner('user-b')
    expect(store.getDraft()).toBeNull()

    store.setDraftOwner('user-a')
    expect(store.getDraft()).toEqual(draftA)
  })

  it('persists per user, so a reload restores the right draft', async () => {
    const data = stubStorage()
    let store = await loadStore()
    store.setDraftOwner('user-a')
    store.setDraft(newDraft({ name: 'Legs' }))
    expect([...data.keys()]).toEqual(['gym-tracker:draft:v1:user-a'])

    store = await loadStore() // simulates a page reload
    store.setDraftOwner('user-a')
    expect(store.getDraft()?.name).toBe('Legs')
  })

  it('ignores writes while logged out', async () => {
    const data = stubStorage()
    const store = await loadStore()
    store.setDraft(newDraft({ name: 'Orphan' }))
    expect(data.size).toBe(0)
  })

  it('clears only the current user draft', async () => {
    const data = stubStorage()
    const store = await loadStore()
    store.setDraftOwner('user-a')
    store.setDraft(newDraft({ name: 'A' }))
    store.setDraftOwner('user-b')
    store.setDraft(newDraft({ name: 'B' }))
    store.setDraft(null)
    expect([...data.keys()]).toEqual(['gym-tracker:draft:v1:user-a'])
  })
})
