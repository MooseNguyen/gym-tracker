import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { ExercisesPage } from './features/exercises/ExercisesPage'
import { HistoryPage } from './features/history/HistoryPage'
import { WorkoutDetailPage } from './features/history/WorkoutDetailPage'
import { HomePage } from './features/home/HomePage'
import { RoutineEditorPage } from './features/routines/RoutineEditorPage'
import { ActiveWorkoutPage } from './features/workout/ActiveWorkoutPage'
import { Layout } from './shared/ui/Layout'

// Recharts is the heaviest dependency and only this page needs it.
const ExerciseStatsPage = lazy(() => import('./features/stats/ExerciseStatsPage'))

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="workout" element={<ActiveWorkoutPage />} />
            <Route path="routines/new" element={<RoutineEditorPage />} />
            <Route path="routines/:id" element={<RoutineEditorPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="history/:id" element={<WorkoutDetailPage />} />
            <Route path="exercises" element={<ExercisesPage />} />
            <Route
              path="exercises/:id"
              element={
                <Suspense fallback={<p className="muted center">Loading…</p>}>
                  <ExerciseStatsPage />
                </Suspense>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
