import { useCallback, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Dialog } from './Dialog'
import {
  ConfirmContext,
  type ConfirmApi,
  type ConfirmOptions,
  type PromptOptions,
} from './confirmContext'

type Request =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void }

/**
 * In-app replacements for window.confirm/prompt: themed bottom sheets built on
 * <Dialog>, used as `if (!(await confirm({...}))) return`. One dialog at a
 * time; opening another cancels the first.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null)
  // The dialog's close event can fire after a button already answered, so the
  // live request is read from a ref and settled exactly once.
  const current = useRef<Request | null>(null)

  const settle = useCallback((value: boolean | string | null) => {
    const r = current.current
    if (!r) return
    current.current = null
    if (r.kind === 'confirm') r.resolve(value === true)
    else r.resolve(typeof value === 'string' ? value : null)
    setRequest(null)
  }, [])

  const open = useCallback(
    (r: Request) => {
      settle(null) // a newer question replaces an unanswered one
      current.current = r
      setRequest(r)
    },
    [settle],
  )

  const api = useRef<ConfirmApi>({
    confirm: (options) => new Promise((resolve) => open({ kind: 'confirm', options, resolve })),
    prompt: (options) => new Promise((resolve) => open({ kind: 'prompt', options, resolve })),
  }).current

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Dialog
        open={request != null}
        onClose={() => settle(null)}
        title={request?.options.title ?? ''}
      >
        {request?.kind === 'confirm' && (
          <ConfirmBody options={request.options} onAnswer={(ok) => settle(ok)} />
        )}
        {request?.kind === 'prompt' && (
          <PromptBody options={request.options} onAnswer={(value) => settle(value)} />
        )}
      </Dialog>
    </ConfirmContext.Provider>
  )
}

function ConfirmBody({
  options,
  onAnswer,
}: {
  options: ConfirmOptions
  onAnswer: (ok: boolean) => void
}) {
  return (
    <div className="stack confirm-body">
      {/* Text gets its paragraph; markup (a list) brings its own: no <ul> inside a <p>. */}
      {typeof options.message === 'string' ? <p>{options.message}</p> : options.message}
      <div className="row confirm-actions">
        <button type="button" className="btn" onClick={() => onAnswer(false)}>
          {options.cancelLabel ?? 'Cancel'}
        </button>
        <button
          type="button"
          className={options.danger ? 'btn danger-fill grow' : 'btn primary grow'}
          onClick={() => onAnswer(true)}
          // The safe choice gets focus for destructive questions (Enter must not delete).
          autoFocus={!options.danger}
        >
          {options.confirmLabel ?? 'OK'}
        </button>
      </div>
    </div>
  )
}

function PromptBody({
  options,
  onAnswer,
}: {
  options: PromptOptions
  onAnswer: (value: string | null) => void
}) {
  const [value, setValue] = useState(options.initialValue ?? '')
  const trimmed = value.trim()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (trimmed) onAnswer(trimmed)
  }

  return (
    <form className="stack confirm-body" onSubmit={submit}>
      <label className="field">
        <span>{options.label}</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </label>
      <div className="row confirm-actions">
        <button type="button" className="btn" onClick={() => onAnswer(null)}>
          Cancel
        </button>
        <button className="btn primary grow" disabled={!trimmed}>
          {options.confirmLabel ?? 'Save'}
        </button>
      </div>
    </form>
  )
}
