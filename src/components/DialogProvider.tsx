import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import {
  DialogContext,
  type ConfirmOptions,
  type DialogApi,
  type ShowTextOptions,
  type TypeToConfirmOptions,
} from './dialog-context'

type Active =
  | { id: number; kind: 'confirm'; opts: ConfirmOptions; resolve: (ok: boolean) => void }
  | { id: number; kind: 'typing'; opts: TypeToConfirmOptions; resolve: (ok: boolean) => void }
  | { id: number; kind: 'text'; opts: ShowTextOptions; resolve: () => void }

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled])'

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null)
  const activeRef = useRef<Active | null>(null)
  const counter = useRef(0)

  /** 새 창을 연다. 이미 열려 있던 창은 취소로 닫는다. */
  const open = useCallback((make: (id: number) => Active) => {
    const prev = activeRef.current
    if (prev) {
      if (prev.kind === 'text') prev.resolve()
      else prev.resolve(false)
    }
    const next = make(++counter.current)
    activeRef.current = next
    setActive(next)
  }, [])

  const finish = useCallback((ok: boolean) => {
    const cur = activeRef.current
    if (!cur) return
    activeRef.current = null
    setActive(null)
    if (cur.kind === 'text') cur.resolve()
    else cur.resolve(ok)
  }, [])

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (o) =>
        new Promise<boolean>((resolve) =>
          open((id) => ({ id, kind: 'confirm', opts: typeof o === 'string' ? { message: o } : o, resolve })),
        ),
      confirmTyping: (o) =>
        new Promise<boolean>((resolve) => open((id) => ({ id, kind: 'typing', opts: o, resolve }))),
      showText: (o) => new Promise<void>((resolve) => open((id) => ({ id, kind: 'text', opts: o, resolve }))),
    }),
    [open],
  )

  return (
    <DialogContext.Provider value={api}>
      {children}
      {active && <DialogView key={active.id} active={active} finish={finish} />}
    </DialogContext.Provider>
  )
}

function DialogView({ active, finish }: { active: Active; finish: (ok: boolean) => void }) {
  const [typed, setTyped] = useState('')
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [before] = useState(() => document.activeElement as HTMLElement | null)

  // 열릴 때 알맞은 곳에 포커스를 주고, 닫히면 원래 있던 곳으로 돌려준다
  useEffect(() => {
    const root = ref.current
    root?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    if (active.kind === 'text') root?.querySelector('textarea')?.select()
    return () => before?.focus?.()
  }, [active.kind, before])

  const title =
    active.opts.title ?? (active.kind === 'confirm' ? '확인' : active.kind === 'typing' ? '삭제 확인' : '복사하기')

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      finish(false)
      return
    }
    if (e.key !== 'Tab') return
    // 창 밖으로 포커스가 나가지 않게 창 안에서만 돌린다
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMsg('복사했습니다.')
    } catch {
      setCopyMsg('복사하지 못했어요. 위 글자를 길게 눌러 직접 복사해 주세요.')
    }
  }

  function submitTyping(e: FormEvent) {
    e.preventDefault()
    if (active.kind === 'typing' && typed.trim() === active.opts.expected.trim()) finish(true)
  }

  const danger = active.kind === 'confirm' ? Boolean(active.opts.danger) : active.kind === 'typing'
  const matches = active.kind === 'typing' && typed.trim() === active.opts.expected.trim()

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && finish(false)}>
      <div
        className="dialog"
        role={danger ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId}>{title}</h2>
        {active.kind !== 'text' && <p className="dialog-message">{active.opts.message}</p>}
        {active.kind === 'text' && (
          <>
            {active.opts.message && <p className="dialog-message">{active.opts.message}</p>}
            <textarea className="dialog-text" readOnly rows={3} value={active.opts.text} data-autofocus onFocus={(e) => e.currentTarget.select()} />
            {copyMsg && <p className="hint" role="status">{copyMsg}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => copy(active.opts.text)}>
                복사
              </button>
              <button type="button" className="btn" onClick={() => finish(true)}>
                닫기
              </button>
            </div>
          </>
        )}

        {active.kind === 'confirm' && (
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" data-autofocus={danger ? '' : undefined} onClick={() => finish(false)}>
              {active.opts.cancelLabel ?? '취소'}
            </button>
            <button
              type="button"
              className={danger ? 'btn btn-danger-solid' : 'btn'}
              data-autofocus={danger ? undefined : ''}
              onClick={() => finish(true)}
            >
              {active.opts.confirmLabel ?? '확인'}
            </button>
          </div>
        )}

        {active.kind === 'typing' && (
          <form onSubmit={submitTyping}>
            <label className="dialog-field">
              <span>
                삭제하려면 아래 글자를 그대로 입력하세요: <b>{active.opts.expected}</b>
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                data-autofocus
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => finish(false)}>
                취소
              </button>
              <button type="submit" className="btn btn-danger-solid" disabled={!matches}>
                {active.opts.confirmLabel ?? '삭제'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
