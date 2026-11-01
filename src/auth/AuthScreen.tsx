import { useState, type FormEvent } from 'react'
import { useAuth } from './useAuth'
import Brand, { APP_TAGLINE } from '../components/Brand'
import { supabase } from '../lib/supabase'
import { PHONE_RE, USERNAME_RE, normalizeUsername } from './username'
import { AGE_RE, INTEREST_OPTIONS, STUDENT_NO_RE } from './application'
import type { InterestKey } from './application'

type Mode = 'login' | 'signup' | 'reset'

export default function AuthScreen() {
  const { signIn, signUp, isUsernameAvailable } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [loginId, setLoginId] = useState('')
  const [phone, setPhone] = useState('')
  const [idStatus, setIdStatus] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [age, setAge] = useState('')
  const [source, setSource] = useState('')
  const [certifications, setCertifications] = useState('')
  const [interests, setInterests] = useState<InterestKey[]>([])
  const [interestOther, setInterestOther] = useState('')
  const [motivation, setMotivation] = useState('')
  const [introduction, setIntroduction] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setIdStatus(null)
    setError(null)
    setNotice(null)
  }

  function toggleInterest(k: InterestKey) {
    setInterests((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))
  }

  async function checkId() {
    const id = loginId.trim()
    if (!USERNAME_RE.test(id)) return setIdStatus('아이디는 영문·숫자 4~20자로 입력해 주세요.')
    setIdStatus('확인 중...')
    const ok = await isUsernameAvailable(id)
    setIdStatus(ok === null ? '확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' : ok ? '사용할 수 있는 아이디입니다.' : '이미 사용 중인 아이디입니다.')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const trimmedId = loginId.trim()

    // 비밀번호 재설정 요청: 임원진 관리 화면에 요청이 올라간다.
    if (mode === 'reset') {
      if (!USERNAME_RE.test(trimmedId)) return setError('아이디는 영문·숫자 4~20자로 입력해 주세요.')
      setBusy(true)
      const { error: err } = await supabase.rpc('request_password_reset', {
        p_username: normalizeUsername(trimmedId),
      })
      setBusy(false)
      if (err) return setError('요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setMode('login')
      setNotice('재설정을 요청했습니다. 임원진이 확인하고 연락드립니다. 임시 비밀번호를 받으면 로그인한 뒤 "내 정보"에서 바꿔 주세요.')
      return
    }

    if (!password) return setError('비밀번호를 입력해 주세요.')

    if (mode === 'signup') {
      if (!USERNAME_RE.test(trimmedId)) return setError('아이디는 영문·숫자 4~20자로 입력해 주세요.')
      const digits = phone.replace(/[\s-]/g, '')
      if (digits && !PHONE_RE.test(digits)) return setError('전화번호는 숫자 9~11자리로 입력해 주세요.')
      const trimmedName = name.trim()
      if (trimmedName.length < 1 || trimmedName.length > 30) return setError('이름은 1~30자로 입력해 주세요.')
      if (password.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.')
      if (!inviteCode.trim()) return setError('가입 코드를 입력해 주세요.')

      const trimmedStudentNo = studentNo.trim()
      if (!STUDENT_NO_RE.test(trimmedStudentNo)) return setError('학번은 숫자 4~12자리로 입력해 주세요.')
      const trimmedAge = age.trim()
      if (!AGE_RE.test(trimmedAge) || Number(trimmedAge) < 14) return setError('나이는 14~99 사이 숫자로 입력해 주세요.')
      const trimmedMotivation = motivation.trim()
      if (trimmedMotivation.length < 1) return setError('가입 동기를 입력해 주세요.')
      const trimmedIntro = introduction.trim()
      if (trimmedIntro.length < 1) return setError('자기소개를 입력해 주세요.')
      const trimmedOther = interestOther.trim()
      if (interests.includes('etc') && !trimmedOther) return setError('기타 관심 분야를 입력해 주세요.')

      setBusy(true)
      if ((await isUsernameAvailable(trimmedId)) === false) {
        setBusy(false)
        setIdStatus('이미 사용 중인 아이디입니다.')
        return setError('이미 사용 중인 아이디입니다.')
      }
      const result = await signUp({
        username: trimmedId,
        name: trimmedName,
        password,
        inviteCode: inviteCode.trim(),
        phone: digits || undefined,
        application: {
          studentNo: trimmedStudentNo,
          age: Number(trimmedAge),
          source: source.trim() || undefined,
          certifications: certifications.trim() || undefined,
          interests,
          interestOther: interests.includes('etc') ? trimmedOther : undefined,
          motivation: trimmedMotivation,
          introduction: trimmedIntro,
        },
      })
      setBusy(false)
      if (result.error) return setError(result.error)
      if (result.needsEmailConfirm) {
        setNotice('가입 요청은 접수되었지만 계정 확인이 필요합니다. 임원진에게 문의해 주세요.')
        setMode('login')
      }
      return
    }

    if (!trimmedId) return setError('아이디를 입력해 주세요.')
    setBusy(true)
    const err = await signIn(trimmedId, password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <div className="auth-wrap">
      <header className="app-header">
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <Brand />
          <p>{APP_TAGLINE}</p>
          <p>동아리 내부 전용 · 로그인이 필요합니다</p>
        </div>
      </header>

      <main className="container" style={{ maxWidth: 420 }}>
        <section className="card">
          {mode === 'reset' ? (
            <>
              <h2>비밀번호 재설정 요청</h2>
              <p className="hint" style={{ margin: '4px 0 12px' }}>
                아이디를 입력하면 임원진에게 요청이 전달됩니다. 임원진이 직접 연락해 본인을 확인한 뒤 임시 비밀번호를 알려
                드려요.
              </p>
            </>
          ) : (
            <div className="tabs">
              <button type="button" className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => switchMode('login')}>
                로그인
              </button>
              <button type="button" className={mode === 'signup' ? 'tab active' : 'tab'} onClick={() => switchMode('signup')}>
                가입
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} className="form" noValidate>
            <label>
              아이디
              <input
                value={loginId}
                onChange={(e) => {
                  setLoginId(e.target.value)
                  setIdStatus(null)
                }}
                maxLength={mode === 'signup' ? 20 : 100}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                placeholder={mode === 'signup' ? '영문·숫자 4~20자' : undefined}
              />
            </label>
            {mode === 'signup' && (
              <>
                <button type="button" className="btn btn-sm btn-ghost" onClick={checkId} disabled={busy}>
                  아이디 중복 확인
                </button>
                {idStatus && <p className="hint" role="status">{idStatus}</p>}
                <label>
                  이름 (표시용)
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoComplete="name" />
                </label>
              </>
            )}
            {mode !== 'reset' && (
              <label>
                비밀번호
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </label>
            )}
            {mode === 'signup' && (
              <>
                <label>
                  가입 코드
                  <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} autoComplete="off" />
                </label>
                <label>
                  전화번호 (선택)
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={13}
                    autoComplete="tel"
                    placeholder="01012345678"
                  />
                </label>
                <p className="form-section">가입 신청서</p>
                <label>
                  학번
                  <input
                    value={studentNo}
                    onChange={(e) => setStudentNo(e.target.value)}
                    maxLength={12}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="숫자만 입력"
                  />
                </label>
                <label>
                  나이
                  <input
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    maxLength={2}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="예: 21"
                  />
                </label>
                <label>
                  Log_on을 알게 된 경로 (선택)
                  <input value={source} onChange={(e) => setSource(e.target.value)} maxLength={100} placeholder="예: 친구 소개, 포스터" />
                </label>
                <label>
                  보유 자격증 (선택)
                  <input
                    value={certifications}
                    onChange={(e) => setCertifications(e.target.value)}
                    maxLength={200}
                    placeholder="없으면 비워 두세요"
                  />
                </label>
                <div className="form-group">
                  <span className="form-group-title">관심 분야 (선택, 여러 개 선택 가능)</span>
                  <div className="day-picker">
                    {INTEREST_OPTIONS.map(([key, label]) => (
                      <button
                        type="button"
                        key={key}
                        className={interests.includes(key) ? 'chip on' : 'chip'}
                        aria-pressed={interests.includes(key)}
                        onClick={() => toggleInterest(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {interests.includes('etc') && (
                  <label>
                    기타 관심 분야
                    <input value={interestOther} onChange={(e) => setInterestOther(e.target.value)} maxLength={100} />
                  </label>
                )}
                <label>
                  가입 동기
                  <textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} maxLength={500} rows={3} />
                </label>
                <label>
                  자기소개
                  <textarea value={introduction} onChange={(e) => setIntroduction(e.target.value)} maxLength={1000} rows={5} />
                </label>
                <p className="hint">
                  수집 항목: 아이디, 이름, 비밀번호(암호화 저장), 전화번호(선택), 가입 신청서(학번, 나이, 알게 된 경로, 자격증,
                  관심 분야, 가입 동기, 자기소개). 아이디와 이름은 동아리 부원 확인과 로그인에, 전화번호는 긴급 연락에,
                  가입 신청서는 가입 승인 심사에만 사용합니다. 전화번호와 가입 신청서는 본인과 임원진만 볼 수 있습니다.
                  가입 후 임원진이 승인해야 이용할 수 있습니다.
                </p>
              </>
            )}

            {error && <p className="msg error" role="alert">{error}</p>}
            {notice && <p className="msg ok" role="status">{notice}</p>}

            <button className="btn" type="submit" disabled={busy}>
              {busy ? '처리 중...' : mode === 'login' ? '로그인' : mode === 'reset' ? '재설정 요청' : '가입하기'}
            </button>
            {mode === 'login' && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => switchMode('reset')}>
                비밀번호를 잊었어요
              </button>
            )}
            {mode === 'reset' && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => switchMode('login')}>
                ← 로그인으로
              </button>
            )}
          </form>
        </section>
      </main>
    </div>
  )
}
