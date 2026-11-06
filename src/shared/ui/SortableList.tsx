import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface ItemControls {
  /** Put on the element that starts a drag (the whole card)… */
  dragRef: (el: HTMLElement | null) => void
  /** …and spread these on the same element. */
  dragListeners: Record<string, unknown>
  isDragging: boolean
  /** Keyboard / screen reader alternative to dragging. */
  moveUp?: () => void
  moveDown?: () => void
}

interface Props<T extends { id: string }> {
  items: T[]
  /** Called with the dragged item's id and the id of the item it was dropped on. */
  onReorder: (fromId: string, toId: string) => void
  renderItem: (item: T, controls: ItemControls) => ReactNode
  /** Human name of an item, used in screen reader announcements. */
  getLabel: (item: T) => string
}

// Lists only move vertically; locking x keeps a sloppy thumb drag from sliding cards sideways.
const lockX: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/**
 * A press on these never starts a drag, so typing kg/reps, ticking ✓ and picking
 * a set type work as usual. The accordion toggle is a button too, but it stays
 * draggable: it covers most of the card header, the natural place to grab.
 */
const NO_DRAG = 'input, textarea, select, a, button:not(.disclosure-toggle), [data-no-drag]'
const canStartDrag = (event: Event) => !(event.target as Element | null)?.closest(NO_DRAG)

class CardMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: 'onMouseDown' as const,
      handler: ({ nativeEvent }: { nativeEvent: MouseEvent }) =>
        nativeEvent.button === 0 && canStartDrag(nativeEvent),
    },
  ]
}

class CardTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent }: { nativeEvent: TouchEvent }) => canStartDrag(nativeEvent),
    },
  ]
}

/**
 * The card under the pointer moves with it, so the mouseup often lands on the
 * same accordion toggle that received the mousedown, and the browser then
 * "clicks" it. Swallow that one click right after a drag ends.
 */
function swallowNextClick() {
  const stop = (e: Event) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', stop, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0)
}

/**
 * Drag-and-drop list built on dnd-kit. Dragging starts from anywhere on an item:
 * - Touch: press and hold ~250 ms first. Without the hold, every swipe over a
 *   card would drag it, and the page could not scroll (it is almost all cards).
 * - Mouse: after moving a few px, so a click is still a click.
 * Why not the HTML5 drag-and-drop API: it does not fire for touch on iOS Safari.
 * Keyboard and screen reader users get Move up / Move down buttons instead
 * (a whole card cannot be a focusable "button" when it contains inputs).
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  getLabel,
}: Props<T>) {
  const [announcement, setAnnouncement] = useState('')

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
    useSensor(CardMouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(CardTouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  function onDragEnd(e: DragEndEvent) {
    swallowNextClick()
    if (e.over && e.active.id !== e.over.id) onReorder(String(e.active.id), String(e.over.id))
  }

  function move(index: number, dir: -1 | 1) {
    const target = items[index + dir]
    if (!target) return
    onReorder(items[index].id, target.id)
    setAnnouncement(
      `${getLabel(items[index])} moved to position ${index + dir + 1} of ${items.length}.`,
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[lockX]}
      onDragEnd={onDragEnd}
      onDragCancel={swallowNextClick}
      accessibility={{ announcements }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableItem key={item.id} id={item.id}>
            {(dragRef, dragListeners, isDragging) =>
              renderItem(item, {
                dragRef,
                dragListeners,
                isDragging,
                moveUp: index > 0 ? () => move(index, -1) : undefined,
                moveDown: index < items.length - 1 ? () => move(index, 1) : undefined,
              })
            }
          </SortableItem>
        ))}
      </SortableContext>
      <div className="sr-only" role="status" aria-live="polite" data-testid="reorder-status">
        {announcement}
      </div>
    </DndContext>
  )
}

function SortableItem({
  id,
  children,
}: {
  id: string
  children: (
    dragRef: (el: HTMLElement | null) => void,
    dragListeners: Record<string, unknown>,
    isDragging: boolean,
  ) => ReactNode
}) {
  // `attributes` (role="button", tabIndex) are deliberately not used: the
  // activator is a whole card full of inputs, which must not become one button.
  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 5 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'sortable dragging' : 'sortable'}>
      {children(setActivatorNodeRef, listeners ?? {}, isDragging)}
    </div>
  )
}

/**
 * Move up / Move down for keyboard and screen reader users. Visually hidden
 * until focused, so touch users never see them.
 */
export function MoveButtons({ controls, label }: { controls: ItemControls; label: string }) {
  return (
    <div className="move-buttons">
      {controls.moveUp && (
        <button type="button" className="btn small" onClick={controls.moveUp}>
          Move {label} up
        </button>
      )}
      {controls.moveDown && (
        <button type="button" className="btn small" onClick={controls.moveDown}>
          Move {label} down
        </button>
      )}
    </div>
  )
}
