import { Dialog } from '../../shared/ui/Dialog'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { MoveButtons, SortableList } from '../../shared/ui/SortableList'
import type { DraftExercise } from './draft'

interface Props {
  open: boolean
  exercises: DraftExercise[]
  onReorder: (fromId: string, toId: string) => void
  onRemove: (ex: DraftExercise) => void
  onClose: () => void
}

/**
 * Full-screen list of the workout's exercises, one compact row each: easier
 * to reorder than the full cards. Changes apply to the draft as they happen;
 * Done just closes.
 */
export function ReorderSheet({ open, exercises, onReorder, onRemove, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="Reorder" className="sheet-full">
      <div className="reorder-sheet">
        {exercises.length === 0 ? (
          <p className="muted">No exercises yet.</p>
        ) : (
          <SortableList
            items={exercises}
            onReorder={onReorder}
            getLabel={(ex) => ex.name}
            renderItem={(ex, controls) => (
              <div
                ref={controls.dragRef}
                {...controls.dragListeners}
                className={controls.isDragging ? 'reorder-row dragging' : 'reorder-row'}
                aria-label={ex.name}
                role="group"
              >
                <button
                  type="button"
                  className="reorder-remove"
                  aria-label={`Remove ${ex.name}`}
                  onClick={() => onRemove(ex)}
                >
                  <span aria-hidden="true">−</span>
                </button>
                <ExerciseThumb imagePath={ex.imagePath} name={ex.name} size={44} decorative />
                <span className="reorder-name">{ex.name}</span>
                <span className="reorder-handle" aria-hidden="true">
                  ≡
                </span>
                <MoveButtons controls={controls} label={ex.name} />
              </div>
            )}
          />
        )}
        <div className="sticky-actions">
          <button type="button" className="btn primary block" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Dialog>
  )
}
