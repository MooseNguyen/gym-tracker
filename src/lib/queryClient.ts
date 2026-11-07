import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

/** How long a saved copy of the data may be shown at start-up. */
const PERSIST_MAX_AGE = 24 * 60 * 60_000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Only this user writes this data, so it rarely changes behind our back.
      staleTime: 60_000,
      // Kept as long as the saved copy, or unused queries would be dropped
      // from memory (and so from localStorage) after the default 5 minutes.
      gcTime: PERSIST_MAX_AGE,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * The query cache, saved to localStorage so the app opens with the last data
 * on screen and refreshes it in the background, instead of a spinner on a
 * slow gym connection. Cleared on sign-out (AuthProvider).
 */
export const queryPersister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: 'gym-tracker-query-cache',
})

export const persistOptions = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE,
  // A new deploy may change what a query returns: start from a clean cache.
  buster: __BUILD_ID__,
}
