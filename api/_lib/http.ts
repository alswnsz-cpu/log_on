import type { IncomingMessage, ServerResponse } from 'node:http'

/** 서버 함수(Vercel Node.js)가 받는 요청·응답. Node 기본 http 객체만 쓴다. */
export type Req = IncomingMessage
export type Res = ServerResponse

/** JSON 응답. 로그인한 사용자별 응답이라 브라우저와 중간 서버가 저장하지 않게 한다. */
export function sendJson(res: Res, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(body))
}

export function sendError(res: Res, status: number, message: string): void {
  sendJson(res, status, { error: message })
}

/** Authorization: Bearer <토큰> 에서 토큰만 꺼낸다. 없으면 null */
export function bearerToken(req: Req): string | null {
  const header = req.headers.authorization
  const match = typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header.trim()) : null
  return match ? match[1] : null
}
