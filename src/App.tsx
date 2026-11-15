import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { ExercisesPage } from './features/exercises/ExercisesPage'
import { HistoryPage } from './features/history/HistoryPage'
import { HomePage } from './features/home/HomePage'
import { ConfirmProvider } from './shared/ui/ConfirmDialog'
import { Layout } from './shared/ui/Layout'

// Recharts is the heaviest dependency and only these pages need it.
const ExerciseStatsPage = lazy(() => import('./features/stats/ExerciseStatsPage'))
const BodyWeightPage = lazy(() => import('./features/body/BodyWeightPage'))

// Pages the app does not open on: their own chunks keep the start-up bundle
// small (drag-and-drop lives in the workout and editor chunks). Fetched in
// the background right after start, so opening one later does not wait.
const loaders = {
  workout: () => import('./features/workout/ActiveWorkoutPage'),
  editor: () => import('./features/routines/RoutineEditorPage'),
  detail: () => import('./features/history/WorkoutDetailPage'),
  muscles: () => import('./features/stats/MuscleStatsPage'),
}
const ActiveWorkoutPage = lazy(() =>
  loaders.workout().then((m) => ({ default: m.ActiveWorkoutPage })),
)
const RoutineEditorPage = lazy(() =>
  loaders.editor().then((m) => ({ default: m.RoutineEditorPage })),
)
const WorkoutDetailPage = lazy(() =>
  loaders.detail().then((m) => ({ default: m.WorkoutDetailPage })),
)
const MuscleStatsPage = lazy(() => loaders.muscles().then((m) => ({ default: m.MuscleStatsPage })))

function usePrefetchPages() {
  useEffect(() => {
    // After the first screen is up; Safari has no requestIdleCallback.
    const id = setTimeout(() => Object.values(loaders).forEach((load) => void load()), 1500)
    return () => clearTimeout(id)
  }, [])
}

export function App() {
  usePrefetchPages()
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<RequireAuth />}>
            <Route
              element={
                // A lazy page shows nothing for the moment its chunk takes
                // (it is usually prefetched or precached by then).
                <Suspense fallback={null}>
                  <Layout />
                </Suspense>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="workout" element={<ActiveWorkoutPage />} />
              <Route path="routines/new" element={<RoutineEditorPage />} />
              <Route path="routines/:id" element={<RoutineEditorPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="history/:id" element={<WorkoutDetailPage />} />
              <Route path="exercises" element={<ExercisesPage />} />
              <Route path="stats" element={<MuscleStatsPage />} />
              <Route
                path="exercises/:id"
                element={
                  <Suspense fallback={<p className="muted center">Loading…</p>}>
                    <ExerciseStatsPage />
                  </Suspense>
                }
              />
              <Route
                path="body-weight"
                element={
                  <Suspense fallback={<p className="muted center">Loading…</p>}>
                    <BodyWeightPage />
                  </Suspense>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ConfirmProvider>
    </BrowserRouter>
  )
}
