import { useSyncExternalStore } from 'react'
import type { WorkoutDraft } from './draft'

// Bump the version if WorkoutDraft changes shape, so an old draft is not misread.
// One key per user: a draft must never be shown to, or saved by, another account
// that logs in on the same phone. Each user gets their own draft back on login.
const keyFor = (userId: string) => `gym-tracker:draft:v1:${userId}`

function read(userId: string): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(userId))
    return raw ? (JSON.parse(raw) as WorkoutDraft) : null
  } catch {
    return null
  }
}

function write(userId: string, d: WorkoutDraft | null) {
  try {
    if (d) localStorage.setItem(keyFor(userId), JSON.stringify(d))
    else localStorage.removeItem(keyFor(userId))
  } catch {
    // Storage full or blocked: the draft still lives in memory for this session.
  }
}

let owner: string | null = null
let current: WorkoutDraft | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Called by AuthProvider whenever the logged-in user changes (null = logged out). */
export function setDraftOwner(userId: string | null) {
  if (userId === owner) return
  owner = userId
  current = userId ? read(userId) : null
  emit()
}

/**
 * A tiny external store instead of React state or a library:
 * the draft must survive route changes and reloads, and has exactly one writer.
 * Every change is written to localStorage synchronously, so killing the app loses nothing.
 */
export function setDraft(next: WorkoutDraft | null | ((d: WorkoutDraft) => WorkoutDraft)) {
  // No user: there is nowhere this draft could be saved, so ignore the write.
  if (!owner) return
  current = typeof next === 'function' ? (current ? next(current) : null) : next
  write(owner, current)
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDraft(): WorkoutDraft | null {
  return current
}

export function useDraft(): WorkoutDraft | null {
  return useSyncExternalStore(subscribe, getDraft)
}
