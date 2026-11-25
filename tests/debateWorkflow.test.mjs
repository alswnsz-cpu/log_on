import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateDebateResults,
  percentage,
} from '../src/lib/debateWorkflow.ts'

test('01. Standard debate report', () => {
  const ids = Array.from(
    { length: 10 },
    (_, i) => String(i + 1),
  )

  const pre = ids.map((user_id, i) => ({
    user_id,
    stance: i < 6 ? 'agree' : 'disagree',
  }))

  const post = pre.map(opinion => ({
    ...opinion,
    stance:
      opinion.user_id === '1'
        ? 'disagree'
        : ['7', '8'].includes(opinion.user_id)
          ? 'agree'
          : opinion.stance,
  }))

  const result = calculateDebateResults(ids, pre, post)

  assert.equal(result.participantCount, 10)
  assert.equal(result.preAgree, 6)
  assert.equal(result.preDisagree, 4)
  assert.equal(result.postAgree, 7)
  assert.equal(result.postDisagree, 3)
  assert.equal(result.preAgreeRate, 60)
  assert.equal(result.postAgreeRate, 70)
  assert.equal(result.agreeToDisagree, 1)
  assert.equal(result.disagreeToAgree, 2)
  assert.equal(result.unchanged, 7)
  assert.equal(result.changeRate, 30)
  assert.equal(result.conclusionRate, 100)
})

test('02. No participants', () => {
  const result = calculateDebateResults([], [], [])

  assert.equal(result.participantCount, 0)
  assert.equal(result.changeRate, 0)
  assert.equal(result.conclusionRate, 0)
  assert.equal(result.preAgreeRate, 0)
  assert.equal(result.postAgreeRate, 0)
})

test('03. No opinions submitted', () => {
  const result = calculateDebateResults(
    ['1', '2', '3'],
    [],
    [],
  )

  assert.equal(result.participantCount, 3)
  assert.equal(result.preSubmitted, 0)
  assert.equal(result.postSubmitted, 0)
  assert.equal(result.conclusionRate, 0)
  assert.equal(result.changeRate, 0)
})

test('04. Partial submissions', () => {
  const result = calculateDebateResults(
    ['1', '2', '3', '4'],
    [
      { user_id: '1', stance: 'agree' },
      { user_id: '2', stance: 'disagree' },
    ],
    [
      { user_id: '1', stance: 'disagree' },
      { user_id: '3', stance: 'agree' },
    ],
  )

  assert.equal(result.preSubmitted, 2)
  assert.equal(result.postSubmitted, 2)
  assert.equal(result.compared, 1)
  assert.equal(result.changed, 1)
  assert.equal(result.changeRate, 100)
  assert.equal(result.conclusionRate, 50)
})

test('05. All participants maintain stance', () => {
  const opinions = [
    { user_id: '1', stance: 'agree' },
    { user_id: '2', stance: 'disagree' },
  ]

  const result = calculateDebateResults(
    ['1', '2'],
    opinions,
    opinions,
  )

  assert.equal(result.unchanged, 2)
  assert.equal(result.changed, 0)
  assert.equal(result.changeRate, 0)
  assert.equal(result.conclusionRate, 100)
})

test('06. All participants change stance', () => {
  const result = calculateDebateResults(
    ['1', '2'],
    [
      { user_id: '1', stance: 'agree' },
      { user_id: '2', stance: 'disagree' },
    ],
    [
      { user_id: '1', stance: 'disagree' },
      { user_id: '2', stance: 'agree' },
    ],
  )

  assert.equal(result.changed, 2)
  assert.equal(result.changeRate, 100)
  assert.equal(result.unchanged, 0)
})

test('07. Ignore non-participants', () => {
  const result = calculateDebateResults(
    ['1'],
    [
      { user_id: '1', stance: 'agree' },
      { user_id: '999', stance: 'disagree' },
    ],
    [
      { user_id: '1', stance: 'agree' },
      { user_id: '999', stance: 'agree' },
    ],
  )

  assert.equal(result.participantCount, 1)
  assert.equal(result.preSubmitted, 1)
  assert.equal(result.postSubmitted, 1)
  assert.equal(result.unchanged, 1)
  assert.equal(result.changed, 0)
})

test('08. Duplicate participant IDs', () => {
  const result = calculateDebateResults(
    ['1', '1', '2'],
    [],
    [],
  )

  assert.equal(result.participantCount, 2)
})

test('09. Percentage rounding', () => {
  assert.equal(percentage(1, 3), 33.3)
  assert.equal(percentage(2, 3), 66.7)
  assert.equal(percentage(0, 0), 0)
  assert.equal(percentage(10, 10), 100)
})
