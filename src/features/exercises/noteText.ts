// Sticky note per exercise: pure helpers, shared by the sheet and the API.

/** Same bound as the database check (exercise_notes migration). */
export const MAX_NOTE_LENGTH = 200

/**
 * What to store for the typed text: trimmed, or null (delete the note) when
 * nothing is left. The database refuses blank notes, so they never reach it.
 */
export function normalizeNote(text: string): string | null {
  const trimmed = text.trim()
  return trimmed === '' ? null : trimmed
}
