import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** When it changes (the page path, say), a caught error is cleared and the children render again. */
  resetKey?: string
}

interface State {
  failed: boolean
}

/**
 * Shows an error screen instead of a blank page when rendering throws, which
 * includes a lazy page whose code could not be downloaded (offline, or an old
 * chunk gone after a deploy). A class: React has no hook for this.
 *
 * Errors in event handlers and async code don't reach it; mutations and
 * queries show their own errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  // No componentDidCatch: React 19 already logs caught errors (createRoot's
  // onCaughtError), which is also where error reporting will plug in (roadmap 21).

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    // No error details: they mean nothing to the user and can leak internals.
    return (
      <div role="alert" className="page center">
        <h1>Something went wrong</h1>
        <p className="muted">
          Any workout in progress is still saved on this phone. Reloading usually fixes this.
        </p>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
