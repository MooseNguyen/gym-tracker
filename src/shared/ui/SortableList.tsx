import type { CSSProperties, ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/** Props to spread on the drag handle element. */
export type HandleProps = Record<string, unknown> & { ref: (el: HTMLElement | null) => void }

interface Props<T extends { id: string }> {
  items: T[]
  /** Called with the dragged item's id and the id of the item it was dropped on. */
  onReorder: (fromId: string, toId: string) => void
  renderItem: (item: T, handle: HandleProps, isDragging: boolean) => ReactNode
  /** Human name of an item, used in screen reader announcements. */
  getLabel: (item: T) => string
}

// Lists only move vertically; locking x keeps a sloppy thumb drag from sliding cards sideways.
const lockX: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/**
 * Drag-and-drop list built on dnd-kit.
 * Why not the HTML5 drag-and-drop API: it does not fire for touch on iOS Safari.
 * Dragging starts only from the handle, so the rest of the card scrolls normally,
 * and the keyboard sensor gives the same reordering with Space + arrow keys.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  getLabel,
}: Props<T>) {
  // dnd-kit's default announcements read out raw ids (UUIDs here); say names and positions.
  const label = (id: UniqueIdentifier) => {
    const item = items.find((i) => i.id === id)
    return item ? getLabel(item) : 'item'
  }
  const position = (id: UniqueIdentifier) =>
    `position ${items.findIndex((i) => i.id === id) + 1} of ${items.length}`
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}, ${position(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${label(active.id)} moved to ${position(over.id)}.`
        : `${label(active.id)} is not over a position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${label(active.id)} dropped at ${position(over.id)}.`
        : `${label(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${label(active.id)} cancelled.`,
  }

  const sensors = useSensors(
    // A few px of movement before dragging, so a tap on the handle is not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(e: DragEndEvent) {
    if (e.over && e.active.id !== e.over.id) onReorder(String(e.active.id), String(e.over.id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[lockX]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To reorder, press Space or Enter, move with the arrow keys, then press Space or Enter again. Press Escape to cancel.',
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableItem key={item.id} id={item.id}>
            {(handle, isDragging) => renderItem(item, handle, isDragging)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({
  id,
  children,
}: {
  id: string
  children: (handle: HandleProps, isDragging: boolean) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 5 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'sortable dragging' : 'sortable'}>
      {children({ ref: setActivatorNodeRef, ...attributes, ...listeners }, isDragging)}
    </div>
  )
}

/** The ⠿ grip used as drag handle everywhere. */
export function DragHandle({ handle, label }: { handle: HandleProps; label: string }) {
  const { ref, ...rest } = handle
  return (
    <button type="button" className="drag-handle" aria-label={label} ref={ref} {...rest}>
      <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
        {[3, 8, 13].map((y) =>
          [5.5, 10.5].map((x) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />
          )),
        )}
      </svg>
    </button>
  )
}
