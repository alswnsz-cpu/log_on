import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url ?? 'http://localhost',
  anonKey ?? 'missing-anon-key',
)

export async function checkConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: '.env에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 없습니다.' }
  }
  const { error } = await supabase.auth.getSession()
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Supabase에 연결되었습니다.' }
}
