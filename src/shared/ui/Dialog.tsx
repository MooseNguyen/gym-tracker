import { useEffect, useId, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  /** Extra class on the sheet, e.g. sheet-full for a full-screen list. */
  className?: string
  children: ReactNode
}

/**
 * Thin wrapper over the native <dialog>: showModal() gives focus trapping,
 * Escape to close and an inert background for free.
 */
export function Dialog({ open, onClose, title, className, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  // Unique per dialog: two can be in the page at once (e.g. a picker and a confirm).
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={className ? `sheet ${className}` : 'sheet'}
      onClose={onClose}
      aria-labelledby={titleId}
    >
      <header className="sheet-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="btn ghost" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      {open && children}
    </dialog>
  )
}
