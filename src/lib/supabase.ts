import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://aipodcpbakywbrrilaud.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(url, anonKey || 'cle-absente', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const supabaseConfigured = anonKey.length > 0
