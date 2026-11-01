import { useEffect, useState } from 'react'
import { checkConnection } from '../lib/supabase'

export default function ConnectionCard() {
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    checkConnection().then(setState)
  }, [])

  return (
    <section className="card">
      <h2>
        Supabase 연결 상태{' '}
        {state && (
          <span className={`badge ${state.ok ? 'ok' : 'error'}`}>{state.ok ? '연결됨' : '연결 안 됨'}</span>
        )}
      </h2>
      <p>{state ? state.message : '확인 중...'}</p>
    </section>
  )
}
