import { describe, expect, it } from 'vitest'
import { completeDemoRun, createDemoRun, demoWorkspace } from './model'
import { redact, validateImport } from './pages/LaunchPage'

describe('demo run evidence', () => {
  it('links a tool check to a real tool call', () => {
    const testCase = demoWorkspace.cases[0]
    const run = completeDemoRun(createDemoRun(testCase, demoWorkspace.profiles[0], 'set'), testCase)
    const call = run.events.find(event => event.type === 'tool_call')
    const check = run.results.find(result => result.type === 'tool sequence')
    expect(call).toBeDefined()
    expect(check?.eventIds).toContain(call?.id)
    expect(run.verdict).toBe('pass')
  })
})

describe('canonical import preview', () => {
  const document = {
    schema_version: '1.0', case_snapshot: { case_key: 'sample.case' }, profile_snapshot: {}, runner_limits: {}, run: { status: 'completed' },
    events: [{ event_id: 'first', sequence: 1, type: 'input_message', occurred_at: '2026-09-23T00:00:00Z', parent_event_id: null, payload: {} }],
  }

  it('rejects a causal link to a later event', () => {
    const invalid = { ...document, events: [{ ...document.events[0], parent_event_id: 'later' }] }
    expect(validateImport(invalid).errors).toContain('/events/0/parent_event_id: must reference an earlier event.')
  })

  it('redacts nested secret keys and bearer text before keeping a preview', () => {
    expect(redact({ headers: { authorization: 'Bearer hidden' }, message: 'Bearer hidden' })).toEqual({ headers: { authorization: '[REDACTED]' }, message: 'Bearer [REDACTED]' })
  })
})
