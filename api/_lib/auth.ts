import { createClient } from '@supabase/supabase-js'
import { bearerToken, type Req } from './http.js'

export type AuthResult = { ok: true; userId: string } | { ok: false; status: number; message: string }

/**
 * 요청한 사람이 로그인했고 "승인된 사용자"인지 확인한다(졸업생도 승인된 사용자다).
 * 토큰은 Supabase Auth 가 검증하고, 승인 여부는 그 사용자의 토큰으로 profiles 를 읽어 확인한다(RLS 가 본인 행을 허용한다).
 * 환경변수: SUPABASE_URL(없으면 VITE_SUPABASE_URL), SUPABASE_ANON_KEY(없으면 VITE_SUPABASE_ANON_KEY). 둘 다 공개 값이다.
 */
export async function requireApprovedUser(req: Req): Promise<AuthResult> {
  const token = bearerToken(req)
  if (!token) return { ok: false, status: 401, message: '로그인이 필요합니다.' }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { ok: false, status: 500, message: '서버 설정이 완료되지 않았습니다.' }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return { ok: false, status: 401, message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }

  const profile = await client.from('profiles').select('status').eq('id', data.user.id).maybeSingle()
  if (profile.error) return { ok: false, status: 500, message: '사용자 정보를 확인하지 못했습니다.' }
  if (profile.data?.status !== 'approved') return { ok: false, status: 403, message: '승인된 부원만 볼 수 있습니다.' }

  return { ok: true, userId: data.user.id }
}
