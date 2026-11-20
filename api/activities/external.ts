import type { IncomingMessage, ServerResponse } from 'node:http'
import { serveFeed } from '../_lib/serve.js'

/** GET /api/activities/external — 대외활동 공고(승인된 사용자만) */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return serveFeed(req, res, 'external')
}
