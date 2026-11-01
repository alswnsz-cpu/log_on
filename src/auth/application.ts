/** 가입 신청서 항목. 가입 화면과 임원진 승인 화면이 함께 쓴다. */

export const INTEREST_OPTIONS = [
  ['transport', '운송·배송'],
  ['warehouse', '창고·재고 관리'],
  ['scm', '공급망 관리(SCM)'],
  ['international', '국제물류·무역'],
  ['it', '물류 IT·스마트물류'],
  ['etc', '기타'],
] as const

export type InterestKey = (typeof INTEREST_OPTIONS)[number][0]

export const INTEREST_LABEL = Object.fromEntries(INTEREST_OPTIONS) as Record<InterestKey, string>

export const STUDENT_NO_RE = /^[0-9]{4,12}$/
export const AGE_RE = /^[0-9]{2}$/

/** 가입 화면에서 입력받는 값 */
export interface ApplicationInput {
  studentNo: string
  age: number
  source?: string
  certifications?: string
  interests: InterestKey[]
  interestOther?: string
  motivation: string
  introduction: string
}

/** signup_applications 테이블 한 행 */
export interface Application {
  user_id: string
  student_no: string
  age: number
  source: string | null
  certifications: string | null
  interests: string[]
  interest_other: string | null
  motivation: string
  introduction: string
}
