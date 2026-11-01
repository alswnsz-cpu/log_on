import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

export type Stance = 'agree' | 'disagree' | 'hold'
export type AgendaStatus = 'discussing' | 'decided'

export const STANCE_LABEL: Record<Stance, string> = { agree: '찬성', disagree: '반대', hold: '보류' }
export const STATUS_LABEL: Record<AgendaStatus, string> = { discussing: '토론 중', decided: '확정' }

export interface Agenda {
  id: number
  title: string
  description: string | null
  status: AgendaStatus
  created_at: string
}

export interface StanceCounts {
  agree: number
  disagree: number
  hold: number
}

export function countStances(stances: Stance[]): StanceCounts {
  const c: StanceCounts = { agree: 0, disagree: 0, hold: 0 }
  for (const s of stances) c[s] += 1
  return c
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 작성자 이름. 탈퇴했거나 조회할 수 없는 작성자는 "탈퇴한 부원"으로 보여 준다. */
export function authorName(p: { name: string; status?: string } | null): string {
  return p && p.status !== 'removed' ? p.name : '탈퇴한 부원'
}

/** opinions·decisions·agendas 변경 시 새로고침 없이 다시 불러오도록 Realtime을 구독한다. */
export function useRealtimeRefresh(channelName: string, onChange: () => void) {
  const ref = useRef(onChange)
  useEffect(() => {
    ref.current = onChange
  })

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opinions' }, () => ref.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decisions' }, () => ref.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendas' }, () => ref.current())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelName])
}
