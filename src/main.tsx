import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { persistOptions, queryClient } from './lib/queryClient'
import { AuthProvider } from './features/auth/AuthProvider'
import { App } from './App'
import { ErrorBoundary } from './shared/ui/ErrorBoundary'
import { initMonitoring, reactErrorHandler } from './lib/monitoring'
import './index.css'

// Before the first render, so a crash while starting up is reported too.
initMonitoring()

createRoot(document.getElementById('root')!, {
  // Errors an ErrorBoundary caught, ones nothing caught, and ones React recovered from.
  onCaughtError: reactErrorHandler,
  onUncaughtError: reactErrorHandler,
  onRecoverableError: reactErrorHandler,
}).render(
  <StrictMode>
    {/* Last resort for crashes outside a page (the layout, auth, login). */}
    <ErrorBoundary>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
