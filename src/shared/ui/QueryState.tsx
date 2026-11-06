import type { ReactNode } from 'react'

interface Props {
  isPending: boolean
  error: Error | null
  isEmpty?: boolean
  empty?: ReactNode
  onRetry?: () => void
  children: ReactNode
}

/** One place for the loading / error / empty states every list page needs. */
export function QueryState({ isPending, error, isEmpty, empty, onRetry, children }: Props) {
  if (isPending) return <p className="muted center">Loading…</p>
  if (error)
    return (
      <div role="alert" className="error stack">
        <p>Something went wrong: {error.message}</p>
        {onRetry && (
          <button className="btn" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    )
  if (isEmpty) return <div className="muted center">{empty}</div>
  return <>{children}</>
}
