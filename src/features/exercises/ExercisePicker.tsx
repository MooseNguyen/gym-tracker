import { useState } from 'react'
import { Dialog } from '../../shared/ui/Dialog'
import { QueryState } from '../../shared/ui/QueryState'
import type { Exercise } from '../../types/db'
import { useExercises } from './api'
import { ExerciseList } from './ExerciseList'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (exercises: Exercise[]) => void
  /** Pick exactly one: tapping an exercise picks it and closes (Replace). */
  single?: boolean
  title?: string
}

export function ExercisePicker({ open, onClose, onPick, single, title }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={title ?? 'Add exercises'}>
      <PickerBody onClose={onClose} onPick={onPick} single={single} />
    </Dialog>
  )
}

// Separate component so the selection resets every time the dialog opens.
function PickerBody({ onClose, onPick, single }: Omit<Props, 'open' | 'title'>) {
  const { data = [], isPending, error, refetch } = useExercises()
  const [selected, setSelected] = useState<Exercise[]>([])

  const toggle = (e: Exercise) =>
    setSelected((prev) =>
      prev.some((p) => p.id === e.id) ? prev.filter((p) => p.id !== e.id) : [...prev, e],
    )

  return (
    <div className="stack">
      <QueryState isPending={isPending} error={error} onRetry={refetch}>
        <ExerciseList
          exercises={data}
          renderAction={(e) => {
            if (single)
              return (
                <button
                  type="button"
                  className="btn small"
                  aria-label={`Choose ${e.name}`}
                  onClick={() => {
                    onPick([e])
                    onClose()
                  }}
                >
                  Choose
                </button>
              )
            const isOn = selected.some((s) => s.id === e.id)
            return (
              <button
                type="button"
                className={isOn ? 'btn primary small' : 'btn small'}
                aria-pressed={isOn}
                aria-label={`${isOn ? 'Unselect' : 'Select'} ${e.name}`}
                onClick={() => toggle(e)}
              >
                {isOn ? '✓' : '+'}
              </button>
            )
          }}
          resultsFooter={
            single ? undefined : (
              <div className="sticky-actions">
                <button
                  type="button"
                  className="btn primary block"
                  disabled={selected.length === 0}
                  onClick={() => {
                    onPick(selected)
                    onClose()
                  }}
                >
                  Add {selected.length || ''} exercise{selected.length === 1 ? '' : 's'}
                </button>
              </div>
            )
          }
        />
      </QueryState>
    </div>
  )
}
