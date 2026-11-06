import { useId, useState, type ReactNode } from 'react'

interface Props {
  /** Content of the clickable header row (already inside the toggle button). */
  summary: ReactNode
  /** Controls before the toggle, outside the button (e.g. a drag handle). */
  leading?: ReactNode
  /** Extra controls after the toggle, outside the button (buttons can't nest). */
  actions?: ReactNode
  defaultOpen?: boolean
  /** Controlled mode: pass both to let the parent decide (e.g. "Collapse all"). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  children: ReactNode
}

/**
 * Accordion section: a real <button> with aria-expanded/aria-controls, so it
 * works with keyboard and screen readers. The open/close animation is pure CSS
 * (grid-template-rows 0fr → 1fr), which animates to the content's real height
 * without measuring it in JS.
 * Uncontrolled by default; controlled when `open` is passed.
 */
export function Disclosure({
  summary,
  leading,
  actions,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  className,
  children,
}: Props) {
  const [openState, setOpenState] = useState(defaultOpen)
  const open = openProp ?? openState
  const panelId = useId()

  const toggle = () => {
    if (openProp === undefined) setOpenState(!open)
    onOpenChange?.(!open)
  }

  return (
    <div className={`disclosure ${open ? 'open' : ''} ${className ?? ''}`}>
      <div className="disclosure-head">
        {leading}
        <button
          type="button"
          className="disclosure-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          <svg className="chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          {summary}
        </button>
        {actions}
      </div>
      {/* inert while closed: hidden content must not be reachable with Tab */}
      <div id={panelId} className="disclosure-panel" inert={!open}>
        <div className="disclosure-inner">{children}</div>
      </div>
    </div>
  )
}
