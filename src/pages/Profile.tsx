import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { PHONE_RE } from '../auth/username'
import { MEMBER_COLORS, autoColor } from '../lib/calendar'

export default function Profile() {
  const { session, profile, refreshProfile } = useAuth()
  const userId = session!.user.id

  const [name, setName] = useState(profile?.name ?? '')
  const [phone, setPhone] = useState('')
  const [phoneLoaded, setPhoneLoaded] = useState(false)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [infoOk, setInfoOk] = useState(false)
  const [infoBusy, setInfoBusy] = useState(false)

  // 달력에서 내 일정에 쓰는 색. 색은 한 명만 쓸 수 있어서 다른 부원이 쓰는 색(색 → 이름)도 함께 불러온다.
  const [color, setColor] = useState<string | null>(null)
  const [taken, setTaken] = useState<Record<string, string>>({})
  const [colorLoaded, setColorLoaded] = useState(false)
  const [colorError, setColorError] = useState<string | null>(null)
  const [colorBusy, setColorBusy] = useState(false)
  const [colorReload, setColorReload] = useState(0)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwOk, setPwOk] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)

  // 전화번호는 본인(과 임원진)에게만 보이는 뷰에서 읽는다.
  useEffect(() => {
    let alive = true
    supabase
      .from('profile_private')
      .select('phone')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        setPhone((data?.phone as string | null) ?? '')
        setPhoneLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [userId])

  useEffect(() => {
    let alive = true
    supabase
      .from('profiles')
      .select('id, name, color')
      .eq('status', 'approved')
      .then(({ data }) => {
        if (!alive) return
        const others: Record<string, string> = {}
        let mine: string | null = null
        for (const p of (data ?? []) as { id: string; name: string; color: string | null }[]) {
          if (p.id === userId) mine = p.color
          else if (p.color) others[p.color] = p.name
        }
        setColor(mine)
        setTaken(others)
        setColorLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [userId, colorReload])

  /** 색을 고르면 바로 저장한다. 다른 부원이 먼저 쓴 색이면 막힌다. */
  async function pickColor(next: string) {
    setColorError(null)
    setColorBusy(true)
    const { error } = await supabase.rpc('update_my_color', { p_color: next })
    setColorBusy(false)
    if (error) {
      setColorReload((k) => k + 1)
      return setColorError(
        error.message.includes('이미 다른 부원')
          ? '방금 다른 부원이 이 색을 먼저 골랐어요. 다른 색을 골라 주세요.'
          : '색을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    }
    setColor(next)
  }

  async function saveInfo(e: FormEvent) {
    e.preventDefault()
    setInfoOk(false)
    const trimmedName = name.trim()
    const digits = phone.replace(/[\s-]/g, '')
    if (trimmedName.length < 1 || trimmedName.length > 30) return setInfoError('이름은 1~30자로 입력해 주세요.')
    if (digits && !PHONE_RE.test(digits)) return setInfoError('전화번호는 숫자 9~11자리로 입력해 주세요.')
    setInfoError(null)
    setInfoBusy(true)
    const { error } = await supabase.rpc('update_my_profile', { p_name: trimmedName, p_phone: digits })
    if (error) {
      setInfoBusy(false)
      return setInfoError('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
    await refreshProfile()
    setPhone(digits)
    setInfoBusy(false)
    setInfoOk(true)
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    setPwOk(false)
    if (!current) return setPwError('현재 비밀번호를 입력해 주세요.')
    if (next.length < 8) return setPwError('새 비밀번호는 8자 이상이어야 합니다.')
    if (next.length > 72) return setPwError('새 비밀번호는 72자 이하로 입력해 주세요.')
    if (next !== confirm) return setPwError('새 비밀번호가 서로 다릅니다.')
    if (next === current) return setPwError('새 비밀번호는 현재 비밀번호와 달라야 합니다.')
    setPwError(null)
    setPwBusy(true)
    // 현재 비밀번호가 맞는지 먼저 확인한다.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session!.user.email!,
      password: current,
    })
    if (verifyError) {
      setPwBusy(false)
      return setPwError('현재 비밀번호가 올바르지 않습니다.')
    }
    const { error } = await supabase.auth.updateUser({ password: next })
    setPwBusy(false)
    if (error) return setPwError('비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setCurrent('')
    setNext('')
    setConfirm('')
    setPwOk(true)
  }

  return (
    <>
      <section className="card">
        <h2>내 정보</h2>
        <form className="form" onSubmit={saveInfo}>
          <label>
            이름
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoComplete="name" />
          </label>
          <label>
            전화번호 (선택)
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={13}
              autoComplete="tel"
              placeholder={phoneLoaded ? '01012345678' : '불러오는 중...'}
              disabled={!phoneLoaded}
            />
          </label>
          <p className="hint">아이디는 바꿀 수 없습니다. 전화번호는 본인과 임원진만 볼 수 있습니다.</p>
          {infoError && <p className="msg error" role="alert">{infoError}</p>}
          {infoOk && <p className="msg ok" role="status">저장했습니다.</p>}
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn" disabled={infoBusy || !phoneLoaded}>{infoBusy ? '저장 중...' : '저장'}</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>내 색상</h2>
        <p className="hint" style={{ marginBottom: 10 }}>
          달력에서 내 일정이 이 색으로 보여요. 색을 고르면 바로 저장됩니다. 흐리게 보이는 색은 다른 부원이 쓰고 있어서
          고를 수 없어요.
          {colorLoaded && color === null && ' 남은 색이 없어서 지금은 임시 색으로 보여요.'}
        </p>
        <div className="color-picker" role="group" aria-label="내 색상">
          {MEMBER_COLORS.map((c) => {
            const on = (color ?? autoColor(userId)) === c.hex
            const owner = taken[c.hex]
            return (
              <button
                type="button"
                key={c.hex}
                className={on ? 'color-swatch on' : owner ? 'color-swatch taken' : 'color-swatch'}
                style={{ background: c.hex }}
                aria-label={owner ? `${c.name} (${owner}님이 사용 중)` : c.name}
                aria-pressed={on}
                title={owner ? `${owner}님이 사용 중` : c.name}
                disabled={!colorLoaded || colorBusy || Boolean(owner)}
                onClick={() => pickColor(c.hex)}
              />
            )
          })}
        </div>
        {Object.keys(taken).length > 0 && (
          <div className="cal-legend" aria-label="다른 부원이 쓰는 색">
            {MEMBER_COLORS.filter((c) => taken[c.hex]).map((c) => (
              <span key={c.hex} className="cal-legend-item">
                <i className="cal-dot" style={{ background: c.hex }} />
                {taken[c.hex]}
              </span>
            ))}
          </div>
        )}
        {colorError && <p className="msg error" role="alert" style={{ marginTop: 10 }}>{colorError}</p>}
      </section>

      <section className="card">
        <h2>비밀번호 변경</h2>
        <form className="form" onSubmit={changePassword}>
          <label>
            현재 비밀번호
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </label>
          <label>
            새 비밀번호 (8자 이상)
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </label>
          <label>
            새 비밀번호 확인
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
          {pwError && <p className="msg error" role="alert">{pwError}</p>}
          {pwOk && <p className="msg ok" role="status">비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.</p>}
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn" disabled={pwBusy}>{pwBusy ? '변경 중...' : '비밀번호 변경'}</button>
          </div>
        </form>
      </section>
    </>
  )
}
