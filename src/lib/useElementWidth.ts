import { useEffect, useState, type RefObject } from 'react'

/**
 * 요소의 실제 가로 폭(px). 화면 전체 폭이 아니라 그 요소가 차지한 폭이라서,
 * 사이드바 때문에 본문이 좁아져도 맞게 판단할 수 있다. 처음 측정하기 전에는 0이다.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return width
}
