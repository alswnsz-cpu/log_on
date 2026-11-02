import { createContext, useContext } from 'react'

/**
 * 브라우저 기본 창(confirm, prompt) 대신 쓰는 화면 안 확인 창.
 * 카카오톡 앱 안 브라우저처럼 기본 창을 막는 곳에서도 똑같이 동작한다.
 */
export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** 삭제처럼 되돌릴 수 없는 일이면 true: 확인 버튼이 빨갛고, 처음 포커스가 취소 버튼에 간다 */
  danger?: boolean
}

export interface TypeToConfirmOptions {
  title?: string
  message: string
  /** 사용자가 그대로 입력해야 하는 글자(예: 이름) */
  expected: string
  confirmLabel?: string
}

export interface ShowTextOptions {
  title?: string
  message?: string
  /** 직접 선택해서 복사할 수 있게 보여 줄 글 */
  text: string
}

export interface DialogApi {
  /** 확인하면 true, 취소(Esc, 바깥 클릭 포함)하면 false */
  confirm: (options: ConfirmOptions | string) => Promise<boolean>
  /** expected 를 정확히 입력해야 확인할 수 있다. 확인하면 true */
  confirmTyping: (options: TypeToConfirmOptions) => Promise<boolean>
  /** 글을 보여 주고 직접 복사하게 한다. 닫으면 끝난다 */
  showText: (options: ShowTextOptions) => Promise<void>
}

export const DialogContext = createContext<DialogApi | null>(null)

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('DialogProvider 안에서만 useDialog 를 쓸 수 있습니다.')
  return ctx
}
