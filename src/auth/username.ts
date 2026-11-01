// 아이디 로그인: 아이디를 가짜 이메일(아이디@내부도메인)로 바꿔 Supabase Auth를 그대로 쓴다.
// 이 도메인으로는 메일을 보내지 않는다. Supabase에서 이메일 확인(Confirm email)을 꺼 두어야 한다.
const ID_EMAIL_DOMAIN = (import.meta.env.VITE_ID_EMAIL_DOMAIN as string | undefined) || 'club-id.example.com'

export const USERNAME_RE = /^[A-Za-z0-9]{4,20}$/
export const PHONE_RE = /^[0-9]{9,11}$/

/** 아이디는 대소문자를 구분하지 않으므로 항상 소문자로 맞춘다. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${ID_EMAIL_DOMAIN}`
}

/** 입력에 @가 있으면 기존 이메일 계정으로, 없으면 아이디로 처리한다. */
export function loginIdToEmail(input: string): string {
  const v = input.trim()
  return v.includes('@') ? v : usernameToEmail(v)
}
