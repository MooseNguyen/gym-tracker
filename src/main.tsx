import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { persistOptions, queryClient } from './lib/queryClient'
import { AuthProvider } from './features/auth/AuthProvider'
import { App } from './App'
import { ErrorBoundary } from './shared/ui/ErrorBoundary'
import './index.css'

createRoot(document.getElementById('root')!).render(
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
