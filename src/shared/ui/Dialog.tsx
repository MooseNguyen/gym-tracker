import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * Thin wrapper over the native <dialog>: showModal() gives focus trapping,
 * Escape to close and an inert background for free.
 */
export function Dialog({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="dialog-title">
      <header className="sheet-header">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="btn ghost" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      {open && children}
    </dialog>
  )
}
