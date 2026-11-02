export const DAY_LABELS = ['월', '화', '수', '목', '금'] as const
export const DAY_START = 540 // 09:00
export const DAY_END = 1080 // 18:00
export const STEP = 30
export const SLOT_COUNT = (DAY_END - DAY_START) / STEP // 18
/** 공통 시간 추천은 이 시각(12:00) 이후에 시작하는 구간만 */
export const RECOMMEND_FROM = 720

export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function hhmmToMin(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

/** 슬롯 번호(0~17) → 시작 분 */
export function slotToMin(slot: number): number {
  return DAY_START + slot * STEP
}

/** 시작·종료 분 → 슬롯 번호 구간 [from, to) */
export function minRangeToSlots(startMin: number, endMin: number): [number, number] {
  return [(startMin - DAY_START) / STEP, (endMin - DAY_START) / STEP]
}

/** 하루 슬롯 18개 */
export function daySlots(): { slot: number; start: number; end: number }[] {
  return Array.from({ length: SLOT_COUNT }, (_, slot) => ({
    slot,
    start: slotToMin(slot),
    end: slotToMin(slot) + STEP,
  }))
}

/** 시작 시간 선택지(09:00~17:30) / 종료 시간 선택지(09:30~18:00) */
export const START_OPTIONS = daySlots().map((s) => s.start)
export const END_OPTIONS = daySlots().map((s) => s.end)

export interface BusyBlock {
  user_id: string
  day: number
  start_min: number
  end_min: number
}

export interface Member {
  id: string
  name: string
}

export interface Availability {
  /** busy[userId][day][slot] */
  busy: Map<string, boolean[][]>
  /** free[day][slot] = 그 슬롯에 가능한 인원 */
  free: number[][]
  /** 시간표에 한 건도 없는 부원 */
  noInput: Member[]
}

export function computeAvailability(members: Member[], blocks: BusyBlock[]): Availability {
  const busy = new Map<string, boolean[][]>()
  for (const m of members) {
    busy.set(
      m.id,
      DAY_LABELS.map(() => Array<boolean>(SLOT_COUNT).fill(false)),
    )
  }
  const hasInput = new Set<string>()
  for (const b of blocks) {
    const grid = busy.get(b.user_id)
    if (!grid || b.day < 0 || b.day >= DAY_LABELS.length) continue
    hasInput.add(b.user_id)
    const [from, to] = minRangeToSlots(b.start_min, b.end_min)
    for (let s = Math.max(0, from); s < Math.min(SLOT_COUNT, to); s++) grid[b.day][s] = true
  }
  const free = DAY_LABELS.map((_, d) =>
    Array.from({ length: SLOT_COUNT }, (_, s) => {
      let n = 0
      for (const m of members) if (!busy.get(m.id)![d][s]) n++
      return n
    }),
  )
  return { busy, free, noInput: members.filter((m) => !hasInput.has(m.id)) }
}

export interface Candidate {
  day: number
  startMin: number
  endMin: number
  available: Member[]
}

/**
 * 연속 slotsNeeded칸 동안 계속 가능한 인원이 많은 순(전원 가능 우선)으로 추천.
 * 같은 요일에서 겹치는 구간은 더 좋은 쪽 하나만 남긴다.
 */
export function findCandidates(
  members: Member[],
  availability: Availability,
  slotsNeeded: number,
  limit = 5,
  /** 이 시각(분) 이전에 시작하는 구간은 추천하지 않는다. 기본은 하루의 처음부터 */
  earliestStartMin = DAY_START,
): Candidate[] {
  const all: Candidate[] = []
  const firstSlot = Math.max(0, Math.ceil((earliestStartMin - DAY_START) / STEP))
  for (let day = 0; day < DAY_LABELS.length; day++) {
    for (let from = firstSlot; from + slotsNeeded <= SLOT_COUNT; from++) {
      const available = members.filter((m) => {
        const row = availability.busy.get(m.id)![day]
        for (let s = from; s < from + slotsNeeded; s++) if (row[s]) return false
        return true
      })
      if (available.length === 0) continue
      all.push({
        day,
        startMin: slotToMin(from),
        endMin: slotToMin(from + slotsNeeded),
        available,
      })
    }
  }
  all.sort(
    (a, b) => b.available.length - a.available.length || a.day - b.day || a.startMin - b.startMin,
  )
  const picked: Candidate[] = []
  for (const c of all) {
    if (picked.some((p) => p.day === c.day && c.startMin < p.endMin && p.startMin < c.endMin)) continue
    picked.push(c)
    if (picked.length >= limit) break
  }
  return picked
}

export function formatCandidate(c: Candidate, total: number): string {
  return `${DAY_LABELS[c.day]}요일 ${minToHHMM(c.startMin)}~${minToHHMM(c.endMin)} (${c.available.length}/${total}명 가능)`
}
