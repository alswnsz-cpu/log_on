import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useDialog } from '../dialog-context'
import { supabase } from '../../lib/supabase'
import type { Agenda } from '../../lib/agendas'
import {
  DEBATE_STAGE_LABEL,
} from '../../lib/debateWorkflow'

import {
  getDebateSession,
  getDebateMembers,
  getDebateParticipants,
  getDebatePreOpinions,
  getDebatePostOpinions,
  getDebateHasVoted,
  getDebateVoteCount,
  getDebateSnapshot,
  getDebateMvpResults,
  setDebateParticipant,
  submitDebatePreOpinion,
  submitDebatePostOpinion,
  submitDebateVote,
  advanceDebateStage,
  finalizeDebate,
  editDebateAgenda,
  cancelDebateAgenda,
  type DebateSession,
  type DebateStats,
} from '../../lib/debateApi'

import DebateStepper from './DebateStepper'
import DebateParticipants, {
  type DebateMember,
} from './DebateParticipants'
import DebatePreOpinion, {
  type PreOpinion,
} from './DebatePreOpinion'
import DebateDiscussion from './DebateDiscussion'
import DebatePostOpinion, {
  type PostOpinion,
} from './DebatePostOpinion'
import DebateMvp from './DebateMvp'
import DebateResults, {
  type MvpResult,
} from './DebateResults'
import DebateAdminControls from './DebateAdminControls'
import AgendaNote from '../AgendaNote'

interface Props {
  agendaId: number
  back: string
}

interface WorkflowData {
  agenda: Agenda
  session: DebateSession
  members: DebateMember[]
  participantIds: string[]
  preOpinions: PreOpinion[]
  postOpinions: PostOpinion[]
  hasVoted: boolean
  voteCount: number | null
  votes: MvpResult[]
  summary: string | null
  snapshot?: DebateStats
}

export default function DebateWorkflow({
  agendaId,
  back,
}: Props) {
  const { profile } = useAuth()
  const dialog = useDialog()
  const navigate = useNavigate()

  const userId = profile?.id ?? ''
  const isOfficer = profile?.role === 'officer'

  const [data, setData] = useState<WorkflowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const mounted = useRef(false)
  const running = useRef(false)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current

    try {
      const [agendaResult, session] = await Promise.all([
        supabase
          .from('agendas')
          .select('id, title, description, status, created_at')
          .eq('id', agendaId)
          .maybeSingle(),
        getDebateSession(agendaId),
      ])

      if (agendaResult.error) throw agendaResult.error

      if (!agendaResult.data || !session) {
        throw new Error('Debate not found')
      }

      const [
        members,
        participants,
        preOpinions,
        postOpinions,
        hasVoted,
      ] = await Promise.all([
        getDebateMembers(),
        getDebateParticipants(agendaId),
        getDebatePreOpinions(agendaId),
        getDebatePostOpinions(agendaId),
        session.stage === 'voting'
          ? getDebateHasVoted(agendaId)
          : Promise.resolve(false),
      ])

      const voteCount =
        isOfficer && session.stage === 'voting'
          ? await getDebateVoteCount(agendaId)
          : null

      let votes: MvpResult[] = []
      let summary: string | null = null
      let snapshot: DebateStats | undefined

      if (session.stage === 'closed') {
        const [saved, results, decision] = await Promise.all([
          getDebateSnapshot(agendaId),
          getDebateMvpResults(agendaId),
          supabase
            .from('decisions')
            .select('content')
            .eq('agenda_id', agendaId)
            .maybeSingle(),
        ])

        if (decision.error) throw decision.error

        if (!saved || !decision.data) {
          throw new Error('Final debate records not found')
        }

        snapshot = saved.stats
        votes = results
        summary = decision.data.content
      }

      const latest = await getDebateSession(agendaId)

      if (!latest || latest.stage !== session.stage) {
        throw new Error('Debate stage changed during loading')
      }

      if (
        !mounted.current ||
        currentRequest !== requestId.current
      ) return

      setData({
        agenda: agendaResult.data as Agenda,
        session,
        members,
        participantIds: participants.map(p => p.user_id),
        preOpinions,
        postOpinions,
        hasVoted,
        voteCount,
        votes,
        summary,
        snapshot,
      })

      setLoadError(null)
    } catch (err) {
      console.error('Debate loading failed:', err)

      if (
        mounted.current &&
        currentRequest === requestId.current
      ) {
        setLoadError(
          '토론 정보를 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        )
      }
    } finally {
      if (
        mounted.current &&
        currentRequest === requestId.current
      ) {
        setLoading(false)
      }
    }
  }, [agendaId, isOfficer])

  useEffect(() => {
    mounted.current = true

    let stopped = false
    let timer: ReturnType<typeof setTimeout>

    async function refresh() {
      if (!running.current) {
        await load()
      }

      if (!stopped) {
        timer = setTimeout(refresh, 5000)
      }
    }

    void refresh()

    return () => {
      stopped = true
      mounted.current = false
      // Invalidate pending requests during cleanup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestId.current++
      clearTimeout(timer)
    }
  }, [load])

  async function run(
    action: () => Promise<unknown>,
    successMessage: string,
  ) {
    if (running.current || loadError) return

    running.current = true
    requestId.current++
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      await action()

      if (mounted.current) {
        setNotice(successMessage)
        await load()
      }
    } catch (err) {
      console.error('Debate action failed:', err)

      if (mounted.current) {
        setError(
          '요청을 처리하지 못했습니다. 현재 토론 단계와 권한을 확인해 주세요.',
        )
        await load()
      }
    } finally {
      running.current = false

      if (mounted.current) {
        setBusy(false)
      }
    }
  }

  if (loading && !data) {
    return (
      <section className="card">
        <p>토론 정보를 불러오는 중...</p>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="card">
        <p className="msg error" role="alert">
          {loadError ?? '토론을 찾을 수 없습니다.'}
        </p>
        <div className="actions">
          <button
            className="btn"
            onClick={() => void load()}
          >
            다시 불러오기
          </button>
          <Link to={back}>토론 목록으로</Link>
        </div>
      </section>
    )
  }

  const {
    agenda,
    session,
    members,
    participantIds,
    preOpinions,
    postOpinions,
    hasVoted,
    votes,
    summary,
    snapshot,
  } = data

  const stage = session.stage
  const eligible = participantIds.includes(userId)
  const disabled = busy || Boolean(loadError)

  const myPre =
    preOpinions.find(o => o.user_id === userId) ?? null

  const myPost =
    postOpinions.find(o => o.user_id === userId) ?? null

  const canEdit =
    isOfficer &&
    stage === 'pre' &&
    preOpinions.length === 0

  async function advance() {
    if (!isOfficer || disabled) return

    const messages = {
      pre:
        '토론을 시작할까요? 미제출 인원: ' +
        Math.max(0, participantIds.length - preOpinions.length) +
        '명. 이후 참여자와 사전 의견을 수정할 수 없습니다.',
      discussing:
        '토론을 마치고 최종 의견 제출을 시작할까요?',
      post:
        'MVP 투표를 시작할까요? 미제출 인원: ' +
        Math.max(0, participantIds.length - postOpinions.length) +
        '명. 이후 최종 의견을 수정할 수 없습니다.',
    }

    if (stage === 'closed' || stage === 'voting') return

    const ok = await dialog.confirm({
      title: '토론 단계 변경',
      message: messages[stage],
      confirmLabel: '다음 단계로',
    })

    if (!ok) return

    await run(
      () => advanceDebateStage(agendaId, stage),
      '다음 토론 단계로 이동했습니다.',
    )
  }

  async function finalize(text: string) {
    if (!isOfficer || disabled || stage !== 'voting') return

    const ok = await dialog.confirm({
      title: '토론 종료 및 결과 공개',
      message:
        '토론을 종료하면 의견과 투표를 수정할 수 없습니다. ' +
        (data?.voteCount == null
          ? '현재 투표 인원을 확인하지 못했습니다. '
          : '투표 완료: ' + data.voteCount + '/' +
            participantIds.length + '명. 미투표: ' +
            Math.max(0, participantIds.length - data.voteCount) + '명. ') +
        '정말 토론을 종료하시겠습니까?',
      confirmLabel: '토론 종료',
      danger: true,
    })

    if (!ok) return

    await run(
      () => finalizeDebate(agendaId, text),
      '토론이 종료되었습니다.',
    )
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()

    if (!canEdit || disabled || !editTitle.trim()) return

    await run(async () => {
      await editDebateAgenda(
        agendaId,
        editTitle,
        editDesc,
      )
      setEditing(false)
    }, '토론 정보가 수정되었습니다.')
  }

  async function cancel() {
    if (!canEdit || disabled) return

    const ok = await dialog.confirm({
      title: '토론 삭제',
      message:
        '아직 의견이 제출되지 않은 토론을 삭제할까요? 참여자 지정 정보도 삭제됩니다. 개인 메모는 유지됩니다.',
      confirmLabel: '삭제',
      danger: true,
    })

    if (!ok) return

    await run(async () => {
      await cancelDebateAgenda(agendaId)
      navigate(back, { replace: true })
    }, '토론이 삭제되었습니다.')
  }

  return (
    <div className="debate-workflow">
      <div className="actions">
        <Link to={back} className="btn btn-ghost btn-sm">
          ← 토론 목록
        </Link>
      </div>

      <section className="card">
        <div className="section-head">
          <span className="badge">단계별 토론</span>
          <span className="hint">
            {DEBATE_STAGE_LABEL[stage]}
          </span>
        </div>

        <h1>{agenda.title}</h1>

        {agenda.description && (
          <p className="opinion-text">
            {agenda.description}
          </p>
        )}

        {canEdit && !editing && (
          <div className="actions">
            <button
              className="btn btn-sm btn-ghost"
              disabled={disabled}
              onClick={() => {
                setEditTitle(agenda.title)
                setEditDesc(agenda.description ?? '')
                setEditing(true)
              }}
            >
              수정
            </button>

            <button
              className="btn btn-sm btn-ghost"
              disabled={disabled}
              onClick={() => void cancel()}
            >
              삭제
            </button>
          </div>
        )}

        {canEdit && editing && (
          <form className="form" onSubmit={saveEdit}>
            <label>
              토론 주제
              <input
                value={editTitle}
                maxLength={100}
                onChange={e => setEditTitle(e.target.value)}
                required
              />
            </label>

            <label>
              토론 설명
              <textarea
                value={editDesc}
                maxLength={2000}
                rows={4}
                onChange={e => setEditDesc(e.target.value)}
              />
            </label>

            <div className="actions">
              <button
                className="btn"
                disabled={disabled || !editTitle.trim()}
              >
                저장
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                취소
              </button>
            </div>
          </form>
        )}
      </section>

      {loadError && (
        <div className="msg error" role="alert">
          {loadError}
          <button
            className="btn btn-sm btn-ghost"
            disabled={busy}
            onClick={() => void load()}
          >
            다시 시도
          </button>
        </div>
      )}

      {error && (
        <p className="msg error" role="alert">{error}</p>
      )}

      {notice && (
        <p className="debate-action-notice" role="status">
          {notice}
        </p>
      )}

      <DebateStepper stage={stage} />

      {isOfficer && stage !== 'closed' && (
        <DebateAdminControls
          stage={stage}
          participantCount={participantIds.length}
          preSubmitted={preOpinions.length}
          postSubmitted={postOpinions.length}
          voteCount={data.voteCount}
          busy={disabled}
          onAdvance={advance}
          onFinalize={finalize}
        />
      )}

      {isOfficer && stage === 'pre' && (
        <DebateParticipants
          members={members}
          participantIds={participantIds}
          submittedIds={preOpinions.map(o => o.user_id)}
          locked={false}
          busy={disabled}
          onToggle={(id, selected) =>
            run(
              () => setDebateParticipant(
                agendaId,
                id,
                selected,
              ),
              '참여자 명단이 변경되었습니다.',
            )
          }
        />
      )}

      {!eligible && stage !== 'closed' && (
        <section className="card">
          <h2>토론 참여 안내</h2>
          <p className="hint">
            지정된 참여자만 의견 제출과 MVP 투표에
            참여할 수 있습니다.
          </p>
        </section>
      )}

      {eligible && stage === 'pre' && (
        <DebatePreOpinion
          key={`${agendaId}-${userId}-pre`}
          opinion={myPre}
          locked={false}
          busy={disabled}
          onSubmit={(stance, content) =>
            run(
              () => submitDebatePreOpinion(
                agendaId,
                stance,
                content,
              ),
              '사전 의견이 저장되었습니다.',
            )
          }
        />
      )}

      {(stage === 'discussing' || stage === 'post') && (
        <DebateDiscussion
          opinions={preOpinions}
          members={members}
          participantCount={participantIds.length}
        />
      )}

      {eligible && stage === 'post' && (
        <DebatePostOpinion
          key={`${agendaId}-${userId}-post`}
          preOpinion={myPre}
          opinion={myPost}
          locked={false}
          busy={disabled}
          onSubmit={(stance, reason, conclusion) =>
            run(
              () => submitDebatePostOpinion(
                agendaId,
                stance,
                reason,
                conclusion,
              ),
              '최종 의견 및 결론이 저장되었습니다.',
            )
          }
        />
      )}

      {stage === 'voting' && (
        <DebateMvp
          members={members}
          participantIds={participantIds}
          currentUserId={userId}
          hasVoted={hasVoted}
          busy={disabled}
          onVote={candidateId =>
            run(
              () => submitDebateVote(
                agendaId,
                candidateId,
              ),
              'MVP 투표가 완료되었습니다.',
            )
          }
        />
      )}

      {stage === 'closed' && (
        <DebateResults
          participantIds={participantIds}
          members={members}
          preOpinions={preOpinions}
          postOpinions={postOpinions}
          votes={votes}
          summary={summary}
          snapshot={snapshot}
        />
      )}

      <AgendaNote agendaId={agendaId} />
    </div>
  )
}
