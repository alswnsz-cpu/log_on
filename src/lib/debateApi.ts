import { supabase } from './supabase'
import {
  type DebateStage,
  type DebateStance,
  calculateDebateResults,
} from './debateWorkflow'

import type { DebateMember } from '../components/debate/DebateParticipants'
import type { PreOpinion } from '../components/debate/DebatePreOpinion'
import type { PostOpinion } from '../components/debate/DebatePostOpinion'
import type { MvpResult } from '../components/debate/DebateResults'

export interface DebateSession {
  agenda_id: number
  stage: DebateStage
  created_at: string
  updated_at: string
  participants_confirmed_at: string | null
  closed_at: string | null
}

export interface DebateParticipant {
  agenda_id: number
  user_id: string
}

export type DebateStats =
  ReturnType<typeof calculateDebateResults>

export interface DebateSnapshot {
  agenda_id: number
  stats: DebateStats
  created_at: string
}

// Session lookup

export async function getDebateSession(
  agendaId: number,
): Promise<DebateSession | null> {
  const { data, error } = await supabase
    .from('debate_sessions')
    .select('*')
    .eq('agenda_id', agendaId)
    .maybeSingle()

  if (error) throw error

  return data as DebateSession | null
}

export async function getDebateSessions():
Promise<DebateSession[]> {
  const { data, error } = await supabase
    .from('debate_sessions')
    .select('*')

  if (error) throw error

  return (data ?? []) as DebateSession[]
}

export type DebateSessionState = Pick<
  DebateSession,
  'stage' | 'updated_at' | 'participants_confirmed_at'
>

export async function getDebateSessionState(
  agendaId: number,
): Promise<DebateSessionState | null> {
  const { data, error } = await supabase
    .from('debate_sessions')
    .select('stage, updated_at, participants_confirmed_at')
    .eq('agenda_id', agendaId)
    .maybeSingle()

  if (error) throw error

  return data as DebateSessionState | null
}

export type DebateListState = Pick<
  DebateSession,
  'agenda_id' | 'stage' | 'updated_at'
>

export async function getDebateListState():
Promise<DebateListState[]> {
  const { data, error } = await supabase
    .from('debate_sessions')
    .select('agenda_id, stage, updated_at')
    .order('agenda_id')

  if (error) throw error

  return (data ?? []) as DebateListState[]
}

// Members and participants

export async function getDebateMembers():
Promise<DebateMember[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('status', 'approved')
    .order('name')

  if (error) throw error

  return (data ?? []) as DebateMember[]
}

export async function getDebateParticipants(
  agendaId: number,
): Promise<DebateParticipant[]> {
  const { data, error } = await supabase
    .from('debate_participants')
    .select('agenda_id, user_id')
    .eq('agenda_id', agendaId)

  if (error) throw error

  return (data ?? []) as DebateParticipant[]
}

// Pre-debate opinions

export async function getDebatePreOpinions(
  agendaId: number,
): Promise<PreOpinion[]> {
  const { data, error } = await supabase
    .from('debate_pre_opinions')
    .select('user_id, stance, content')
    .eq('agenda_id', agendaId)

  if (error) throw error

  return (data ?? []) as PreOpinion[]
}

// Post-debate opinions

export async function getDebatePostOpinions(
  agendaId: number,
): Promise<PostOpinion[]> {
  const { data, error } = await supabase
    .from('debate_post_opinions')
    .select('user_id, stance, reason, conclusion')
    .eq('agenda_id', agendaId)

  if (error) throw error

  return (data ?? []) as PostOpinion[]
}

// Voting status

export async function getDebateHasVoted(
  agendaId: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    'debate_has_voted',
    {
      p_agenda_id: agendaId,
    },
  )

  if (error) throw error

  return data === true
}

// Closed debate results

export async function getDebateSnapshot(
  agendaId: number,
): Promise<DebateSnapshot | null> {
  const { data, error } = await supabase
    .from('debate_result_snapshots')
    .select('agenda_id, stats, created_at')
    .eq('agenda_id', agendaId)
    .maybeSingle()

  if (error) throw error

  return data as DebateSnapshot | null
}

export async function getDebateMvpResults(
  agendaId: number,
): Promise<MvpResult[]> {
  const { data, error } = await supabase.rpc(
    'debate_mvp_results',
    {
      p_agenda_id: agendaId,
    },
  )

  if (error) throw error

  return ((data ?? []) as MvpResult[]).map(row => ({
    candidate_id: row.candidate_id,
    vote_count: Number(row.vote_count),
  }))
}

// Create a new debate

export async function createDebateAgenda(
  title: string,
  description: string,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    'debate_create_agenda',
    {
      p_title: title.trim(),
      p_description: description.trim() || null,
    },
  )

  if (error) throw error

  const agendaId = Number(data)

  if (!Number.isSafeInteger(agendaId) || agendaId <= 0) {
    throw new Error('Invalid agenda ID')
  }

  return agendaId
}

// Edit and cancel

export async function editDebateAgenda(
  agendaId: number,
  title: string,
  description: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    'debate_edit_agenda',
    {
      p_agenda_id: agendaId,
      p_title: title.trim(),
      p_description: description.trim() || null,
    },
  )

  if (error) throw error
}

export async function cancelDebateAgenda(
  agendaId: number,
): Promise<void> {
  const { error } = await supabase.rpc(
    'debate_cancel_agenda',
    {
      p_agenda_id: agendaId,
    },
  )

  if (error) throw error
}

// Participant management

export async function setDebateParticipant(
  agendaId: number,
  userId: string,
  selected: boolean,
): Promise<void> {
  const { error } = await supabase.rpc(
    selected
      ? 'debate_add_participant'
      : 'debate_remove_participant',
    {
      p_agenda_id: agendaId,
      p_user_id: userId,
    },
  )

  if (error) throw error
}

export async function confirmDebateParticipants(
  agendaId: number,
): Promise<void> {
  const { error } = await supabase.rpc(
    'debate_confirm_participants',
    {
      p_agenda_id: agendaId,
    },
  )

  if (error) throw error
}

// Submit opinions

export async function submitDebatePreOpinion(
  agendaId: number,
  stance: DebateStance,
  content: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    'debate_submit_pre',
    {
      p_agenda_id: agendaId,
      p_stance: stance,
      p_content: content.trim(),
    },
  )

  if (error) throw error
}

export async function submitDebatePostOpinion(
  agendaId: number,
  stance: DebateStance,
  reason: string,
  conclusion: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    'debate_submit_post',
    {
      p_agenda_id: agendaId,
      p_stance: stance,
      p_reason: reason.trim(),
      p_conclusion: conclusion.trim(),
    },
  )

  if (error) throw error
}

// Stage management

export async function advanceDebateStage(
  agendaId: number,
  expectedStage: DebateStage,
): Promise<DebateStage> {
  const { data, error } = await supabase.rpc(
    'debate_advance_stage',
    {
      p_agenda_id: agendaId,
      p_expected_stage: expectedStage,
    },
  )

  if (error) throw error

  return data as DebateStage
}

// MVP voting

export async function submitDebateVote(
  agendaId: number,
  candidateId: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    'debate_submit_vote',
    {
      p_agenda_id: agendaId,
      p_candidate_id: candidateId,
    },
  )

  if (error) throw error
}

// Finalize debate and preserve results

export async function finalizeDebate(
  agendaId: number,
  summary: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    'debate_finalize',
    {
      p_agenda_id: agendaId,
      p_summary: summary.trim(),
    },
  )

  if (error) throw error
}

// Officer-only voting progress

export async function getDebateVoteCount(
  agendaId: number,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    'debate_vote_count',
    {
      p_agenda_id: agendaId,
    },
  )

  if (error) throw error

  const count = Number(data)

  if (
    data == null ||
    !Number.isSafeInteger(count) ||
    count < 0
  ) {
    throw new Error('Invalid vote count')
  }

  return count
}

// Officer-only submission counts

export interface DebateSubmissionCounts {
  preSubmitted: number
  postSubmitted: number
}

export async function getDebateSubmissionCounts(
  agendaId: number,
): Promise<DebateSubmissionCounts> {
  const { data, error } = await supabase.rpc(
    'debate_submission_counts',
    {
      p_agenda_id: agendaId,
    },
  )

  if (error) throw error

  const preSubmitted = data?.preSubmitted
  const postSubmitted = data?.postSubmitted

  if (
    !Number.isSafeInteger(preSubmitted) ||
    !Number.isSafeInteger(postSubmitted) ||
    preSubmitted < 0 ||
    postSubmitted < 0
  ) {
    throw new Error('Invalid submission counts')
  }

  return {
    preSubmitted,
    postSubmitted,
  }
}
