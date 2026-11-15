import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.',
  )
}

// The anon key is public by design: Row Level Security is what protects the data.
// Typed by the generated schema: a renamed column or RPC argument is a type error.
export const supabase = createClient<Database>(url, anonKey)

// Kept in their own module, which has no side effects: importing it does not
// create the Supabase client (monitoring.ts imports NetworkError from there).
export { NetworkError, unwrap } from './unwrap'
