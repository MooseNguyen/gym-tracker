/**
 * Moves the item with `fromId` to the position of the item with `toId`
 * (the items in between shift by one), like a drag-and-drop drop.
 * Returns the same array when nothing changes, so React can skip a render.
 */
export function reorder<T extends { id: string }>(list: T[], fromId: string, toId: string): T[] {
  const from = list.findIndex((x) => x.id === fromId)
  const to = list.findIndex((x) => x.id === toId)
  if (from < 0 || to < 0 || from === to) return list
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
