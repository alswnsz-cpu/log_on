import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

/**
 * 끌어서 순서를 바꾸는 목록. 줄 왼쪽의 손잡이(⋮⋮)를 잡고 위아래로 끌면 줄이 손가락(마우스)을 따라오고,
 * 다른 줄은 자리를 비켜 준다. 화면 위·아래 끝에 가져가면 자동으로 스크롤된다.
 * 손잡이를 선택하고 ↑ ↓ 키를 눌러도 한 칸씩 옮겨진다.
 * 끌어 놓는 동안에는 줄을 실제로 옮기지 않고 모양만 움직이다가, 놓는 순간 새 순서를 저장한다.
 * (끄는 도중에 화면 요소를 옮기면 터치 입력이 끊기기 때문이다.)
 */
interface Props<T> {
  items: T[]
  getId: (item: T) => string
  /** 새 순서(id 목록)를 저장한다. 끝날 때까지 기다리며, 실패하면 원래 순서로 돌아간다. */
  onReorder: (ids: string[]) => Promise<void> | void
  /** 한 줄의 내용. handle 은 끌기 손잡이이니 줄 안 적당한 곳에 넣는다. */
  renderItem: (item: T, handle: ReactNode) => ReactNode
  disabled?: boolean
  /** 화면 낭독용 이름. 예: "부원" */
  label?: string
}

interface Drag {
  id: string
  from: number
  target: number
  /** 끌기 시작한 포인터의 페이지 기준 Y */
  startY: number
  /** 현재 포인터의 화면 기준 Y */
  pointerY: number
  /** 지금 포인터가 시작점에서 얼마나 움직였는지(스크롤 포함) */
  dy: number
  /** 시작 때 잰 각 줄의 페이지 기준 위치와 높이 */
  rects: { top: number; height: number }[]
  gap: number
}

const EDGE = 80 // 화면 위·아래 끝에서 이 거리 안이면 자동 스크롤
const SCROLL_STEP = 12

export default function SortableList<T>({ items, getId, onReorder, renderItem, disabled, label = '항목' }: Props<T>) {
  const [local, setLocal] = useState<string[] | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const rafRef = useRef<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  const ids = local ?? items.map(getId)
  const byId = new Map(items.map((i) => [getId(i), i]))
  const rows = ids.map((id) => byId.get(id)).filter((x): x is T => x !== undefined)

  /** 새 순서를 화면에 먼저 보여 주고 저장한다. 저장이 끝나면(성공이든 실패든) 서버 순서를 따른다. */
  const commit = useCallback(
    async (next: string[]) => {
      setLocal(next)
      try {
        await onReorder(next)
      } finally {
        setLocal(null)
      }
    },
    [onReorder],
  )

  // 화면을 떠날 때 끌기 중이었다면 정리한다
  useEffect(() => () => stopRef.current?.(), [])

  function startDrag(e: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (disabled || dragRef.current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const list = listRef.current
    if (!list) return
    e.preventDefault()

    const rects = Array.from(list.children).map((li) => {
      const r = li.getBoundingClientRect()
      return { top: r.top + window.scrollY, height: r.height }
    })
    const from = ids.indexOf(id)
    const gap = rects.length > 1 ? rects[1].top - (rects[0].top + rects[0].height) : 0
    const d: Drag = {
      id,
      from,
      target: from,
      startY: e.clientY + window.scrollY,
      pointerY: e.clientY,
      dy: 0,
      rects,
      gap,
    }
    dragRef.current = d
    setDrag({ ...d })

    const onMove = (ev: PointerEvent) => {
      if (dragRef.current) dragRef.current.pointerY = ev.clientY
    }
    const finish = (apply: boolean) => {
      const cur = dragRef.current
      stopRef.current?.()
      if (apply && cur && cur.target !== cur.from) {
        const next = ids.filter((x) => x !== cur.id)
        next.splice(cur.target, 0, cur.id)
        void commit(next)
      }
    }
    const onUp = () => finish(true)
    const onCancel = () => finish(false)
    const onKey = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === 'Escape') finish(false)
    }

    // 매 프레임: 가장자리면 스크롤하고, 끌고 있는 줄이 어느 자리 위에 있는지 계산한다
    const tick = () => {
      const cur = dragRef.current
      if (!cur) return
      if (cur.pointerY < EDGE) window.scrollBy(0, -SCROLL_STEP)
      else if (cur.pointerY > window.innerHeight - EDGE) window.scrollBy(0, SCROLL_STEP)

      cur.dy = cur.pointerY + window.scrollY - cur.startY
      const mine = cur.rects[cur.from]
      const center = mine.top + mine.height / 2 + cur.dy
      let target = 0
      cur.rects.forEach((r, i) => {
        if (i !== cur.from && center > r.top + r.height / 2) target++
      })
      cur.target = target
      setDrag({ ...cur })
      rafRef.current = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
    rafRef.current = requestAnimationFrame(tick)

    stopRef.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      dragRef.current = null
      setDrag(null)
      stopRef.current = null
    }
  }

  function onHandleKey(e: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (disabled || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    const i = ids.indexOf(id)
    const j = e.key === 'ArrowUp' ? i - 1 : i + 1
    if (j < 0 || j >= ids.length) return
    const next = [...ids]
    next.splice(j, 0, next.splice(i, 1)[0])
    void commit(next)
  }

  /** 끄는 동안 각 줄의 모양: 끌린 줄은 포인터를 따라가고, 사이에 낀 줄들은 한 칸씩 비켜 준다 */
  function transformFor(index: number): string | undefined {
    if (!drag) return undefined
    if (index === drag.from) return `translateY(${drag.dy}px)`
    const shift = drag.rects[drag.from].height + drag.gap
    if (drag.from < drag.target && index > drag.from && index <= drag.target) return `translateY(${-shift}px)`
    if (drag.from > drag.target && index >= drag.target && index < drag.from) return `translateY(${shift}px)`
    return undefined
  }

  return (
    <ul className={drag ? 'list sortable is-dragging' : 'list sortable'} ref={listRef}>
      {rows.map((item, index) => {
        const id = getId(item)
        const dragging = drag?.id === id
        const handle = (
          <button
            type="button"
            className="drag-handle"
            aria-label={`${label} 순서 옮기기. 끌거나 위아래 화살표 키를 누르세요.`}
            disabled={disabled}
            onPointerDown={(e) => startDrag(e, id)}
            onMouseDown={(e) => e.preventDefault()}
            onKeyDown={(e) => onHandleKey(e, id)}
          >
            ⋮⋮
          </button>
        )
        return (
          <li
            key={id}
            data-id={id}
            className={dragging ? 'sortable-item dragging' : 'sortable-item'}
            style={{ transform: transformFor(index) }}
          >
            {renderItem(item, handle)}
          </li>
        )
      })}
    </ul>
  )
}
