import { useOutletContext } from 'react-router-dom'

/** Layout 이 화면(Outlet)에 넘겨 주는 값 */
export interface LayoutContext {
  /** 졸업생 여부 */
  alumni: boolean
}

export function useLayoutContext(): LayoutContext {
  return useOutletContext<LayoutContext>()
}
