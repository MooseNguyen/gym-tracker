import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import type { Routine, RoutineFolder } from '../../types/db'

const ROUTINE_SELECT = `
  id, name, notes, folder_id, created_at,
  routine_exercises (
    id, exercise_id, position, target_sets, rest_seconds,
    exercise:exercises (id, user_id, name, muscle_group, secondary_muscles, equipment, kind, image_path, image_path_end)
  )`

export function useRoutines() {
  return useQuery({
    queryKey: ['routines'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('routines')
          .select(ROUTINE_SELECT)
          .order('created_at')
          .order('position', { referencedTable: 'routine_exercises' }),
      ) as unknown as Routine[],
  })
}

export function useRoutine(id: string | undefined) {
  return useQuery({
    queryKey: ['routines', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('routines')
          .select(ROUTINE_SELECT)
          .eq('id', id!)
          .order('position', { referencedTable: 'routine_exercises' })
          .single(),
      ) as unknown as Routine,
  })
}

/** The routine as the server has it now; null when it was deleted. */
export async function fetchRoutine(id: string): Promise<Routine | null> {
  return unwrap(
    await supabase
      .from('routines')
      .select(ROUTINE_SELECT)
      .eq('id', id)
      .order('position', { referencedTable: 'routine_exercises' })
      .maybeSingle(),
  ) as unknown as Routine | null
}

// A type, not an interface: only type aliases fit the generated Json type of the RPC argument.
export type RoutineInput = {
  id?: string
  name: string
  notes: string | null
  folder_id: string | null
  exercises: { exercise_id: string; target_sets: number; rest_seconds: number }[]
}

export function useSaveRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RoutineInput) =>
      unwrap(await supabase.rpc('save_routine', { p: input })) as string,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  })
}

export function useDeleteRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('routines').delete().eq('id', id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  })
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export function useFolders() {
  return useQuery({
    queryKey: ['folders'],
    queryFn: async () =>
      unwrap(
        await supabase.from('routine_folders').select('id, name, created_at').order('created_at'),
      ) as RoutineFolder[],
  })
}

export function useSaveFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id?: string; name: string }) => {
      if (id) unwrap(await supabase.from('routine_folders').update({ name }).eq('id', id))
      else unwrap(await supabase.from('routine_folders').insert({ name }))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  })
}

export function useDeleteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('routine_folders').delete().eq('id', id))
    },
    // Routines in the folder become unfiled (on delete set null), so refetch both.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] })
      qc.invalidateQueries({ queryKey: ['routines'] })
    },
  })
}

export interface FolderGroup {
  folder: RoutineFolder | null // null = "Unfiled"
  routines: Routine[]
}

/**
 * Groups routines under their folders, keeping folder order.
 * Empty folders are kept (the user just created them); the unfiled group is
 * only added when it has routines. A routine pointing at an unknown folder
 * (deleted in another tab) falls back to unfiled instead of disappearing.
 */
export function groupByFolder(folders: RoutineFolder[], routines: Routine[]): FolderGroup[] {
  const known = new Set(folders.map((f) => f.id))
  const groups: FolderGroup[] = folders.map((folder) => ({
    folder,
    routines: routines.filter((r) => r.folder_id === folder.id),
  }))
  const unfiled = routines.filter((r) => !r.folder_id || !known.has(r.folder_id))
  if (unfiled.length > 0) groups.push({ folder: null, routines: unfiled })
  return groups
}
