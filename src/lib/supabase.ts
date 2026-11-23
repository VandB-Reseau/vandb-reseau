import { createClient } from '@supabase/supabase-js'
import { noterRequete } from './tablesTouchees'

const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://aipodcpbakywbrrilaud.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(url, anonKey || 'cle-absente', {
  auth: { persistSession: true, autoRefreshToken: true },
  // Chaque écriture est notée : le rechargement qui suit ne relit que les tables touchées (370)
  global: { fetch: (entree, init) => { noterRequete(entree, init); return fetch(entree, init) } },
})

export const supabaseConfigured = anonKey.length > 0
