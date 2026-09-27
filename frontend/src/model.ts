export type RunStatus = 'queued' | 'running' | 'evaluating' | 'completed' | 'cancelled' | 'failed' | 'timed_out' | 'failed_interrupted'
export type Verdict = 'pass' | 'fail' | 'error' | 'skipped' | 'incomplete'
export type ProviderType = 'fake' | 'openai_compatible'

export interface Suite {
  id: string
  name: string
  description: string
  version: number
  updatedAt: string
}

export interface Evaluator {
  id: string
  type: 'exact_text' | 'contains' | 'json_schema' | 'tool_sequence'
  expected: string
  required: boolean
}

export interface TestCase {
  id: string
  suiteId: string
  caseKey: string
  name: string
  description: string
  revision: number
  input: string
  messages?: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[]
  fixtureTools: string
  evaluators: Evaluator[]
  judgeRubric?: string
  history?: { revision: number; savedAt: string; input: string; fixtureTools: string; evaluators: Evaluator[] }[]
  updatedAt: string
}

export interface Profile {
  id: string
  name: string
  providerType: ProviderType
  baseUrl: string
  model: string
  systemInstructions: string
  temperature: number
  maxTokens: number
  credentialAlias: string
  version: number
}

export interface TraceEvent {
  id: string
  sequence: number
  type: string
  at: string
  label: string
  payload: unknown
  parentId?: string
}

export interface EvaluationResult {
  id: string
  type: string
  verdict: Verdict
  summary: string
  expected: string
  actual: string
  eventIds: string[]
  required: boolean
}

export interface Run {
  id: string
  runSetId: string
  caseId: string
  caseKey: string
  caseName: string
  revision: number
  profileId: string
  profileName: string
  model: string
  source: 'executed' | 'imported'
  status: RunStatus
  verdict: Verdict | 'pending'
  createdAt: string
  durationMs: number | null
  events: TraceEvent[]
  results: EvaluationResult[]
  evaluationHistory?: EvaluationResult[][]
  canonical?: unknown
  caseSnapshot?: TestCase
  profileSnapshot?: Profile
  error?: string
  schemaVersion?: string
}

export interface Workspace {
  suites: Suite[]
  cases: TestCase[]
  profiles: Profile[]
  runs: Run[]
}

export const now = () => new Date().toISOString()
export const id = () => crypto.randomUUID()

const demoTime = '2026-09-23T10:42:00.000Z'

const weatherEvents: TraceEvent[] = [
  { id: 'evt-input', sequence: 1, type: 'input_message', at: demoTime, label: 'User input', payload: { role: 'user', content: 'What is the weather in Tokyo?' } },
  { id: 'evt-request', sequence: 2, type: 'model_request', at: demoTime, label: 'Model request', payload: { model: 'fake-v1', tools: ['lookup_weather'] }, parentId: 'evt-input' },
  { id: 'evt-call', sequence: 3, type: 'tool_call', at: demoTime, label: 'lookup_weather called', payload: { tool_call_id: 'call-1', tool_name: 'lookup_weather', arguments: { city: 'Tokyo' } }, parentId: 'evt-request' },
  { id: 'evt-result', sequence: 4, type: 'tool_result', at: demoTime, label: 'Fixture returned', payload: { tool_call_id: 'call-1', outcome: 'ok', content: { city: 'Tokyo', condition: 'clear', temperature_c: 22 } }, parentId: 'evt-call' },
  { id: 'evt-answer', sequence: 5, type: 'assistant_message', at: demoTime, label: 'Assistant answer', payload: { role: 'assistant', content: 'It is clear and 22°C in Tokyo.' }, parentId: 'evt-result' },
]

export const demoWorkspace: Workspace = {
  suites: [{ id: 'suite-demo', name: 'Agent reliability', description: 'Synthetic fixture tests for tool use and response quality.', version: 1, updatedAt: demoTime }],
  cases: [
    { id: 'case-weather', suiteId: 'suite-demo', caseKey: 'weather.basic', name: 'Weather lookup', description: 'Uses the weather fixture and reports its result.', revision: 3, input: 'What is the weather in Tokyo?', fixtureTools: '[{"name":"lookup_weather","description":"Return fixture weather for a city","fixtures":[{"arguments":{"city":"Tokyo"},"result":{"condition":"clear","temperature_c":22}}]}]', evaluators: [{ id: 'eval-weather', type: 'tool_sequence', expected: 'lookup_weather', required: true }, { id: 'eval-weather-text', type: 'contains', expected: 'Tokyo', required: true }], updatedAt: demoTime },
    { id: 'case-policy', suiteId: 'suite-demo', caseKey: 'policy.no_external', name: 'No external calls', description: 'Checks that the assistant answers from supplied context.', revision: 1, input: 'Summarize the supplied policy in one sentence.', fixtureTools: '[]', evaluators: [{ id: 'eval-policy', type: 'contains', expected: 'approved', required: true }], updatedAt: demoTime },
    { id: 'case-order', suiteId: 'suite-demo', caseKey: 'order.status', name: 'Order status', description: 'Checks a fixture tool response for an order.', revision: 2, input: 'Find the status of order A-104.', fixtureTools: '[{"name":"lookup_order","fixtures":[{"arguments":{"order_id":"A-104"},"result":{"status":"shipped"}}]}]', evaluators: [{ id: 'eval-order', type: 'tool_sequence', expected: 'lookup_order', required: true }], updatedAt: demoTime },
  ],
  profiles: [
    { id: 'profile-fake', name: 'Fixture agent', providerType: 'fake', baseUrl: '', model: 'fake-v1', systemInstructions: 'Use fixture tools when needed. Be concise.', temperature: 0, maxTokens: 512, credentialAlias: '', version: 1 },
  ],
  runs: [
    { id: 'run-weather', runSetId: 'set-001', caseId: 'case-weather', caseKey: 'weather.basic', caseName: 'Weather lookup', revision: 3, profileId: 'profile-fake', profileName: 'Fixture agent', model: 'fake-v1', source: 'executed', status: 'completed', verdict: 'pass', createdAt: demoTime, durationMs: 842, events: weatherEvents, results: [
      { id: 'result-tool', type: 'Tool sequence', verdict: 'pass', summary: 'Expected tool was called once.', expected: 'lookup_weather', actual: 'lookup_weather', eventIds: ['evt-call'], required: true },
      { id: 'result-text', type: 'Contains', verdict: 'pass', summary: 'Answer mentions Tokyo.', expected: 'Tokyo', actual: 'It is clear and 22°C in Tokyo.', eventIds: ['evt-answer'], required: true },
    ] },
    { id: 'run-policy', runSetId: 'set-001', caseId: 'case-policy', caseKey: 'policy.no_external', caseName: 'No external calls', revision: 1, profileId: 'profile-fake', profileName: 'Fixture agent', model: 'fake-v1', source: 'executed', status: 'completed', verdict: 'fail', createdAt: demoTime, durationMs: 574, events: [
      { id: 'policy-input', sequence: 1, type: 'input_message', at: demoTime, label: 'User input', payload: { role: 'user', content: 'Summarize the supplied policy in one sentence.' } },
      { id: 'policy-answer', sequence: 2, type: 'assistant_message', at: demoTime, label: 'Assistant answer', payload: { role: 'assistant', content: 'No policy text was supplied.' }, parentId: 'policy-input' },
    ], results: [{ id: 'policy-result', type: 'Contains', verdict: 'fail', summary: 'Required phrase not found.', expected: 'approved', actual: 'No policy text was supplied.', eventIds: ['policy-answer'], required: true }] },
    { id: 'run-order', runSetId: 'set-002', caseId: 'case-order', caseKey: 'order.status', caseName: 'Order status', revision: 2, profileId: 'profile-fake', profileName: 'Fixture agent', model: 'fake-v1', source: 'executed', status: 'completed', verdict: 'pass', createdAt: demoTime, durationMs: 1016, events: [
      { id: 'order-input', sequence: 1, type: 'input_message', at: demoTime, label: 'User input', payload: { role: 'user', content: 'Find the status of order A-104.' } },
      { id: 'order-call', sequence: 2, type: 'tool_call', at: demoTime, label: 'lookup_order called', payload: { tool_call_id: 'order-tool', tool_name: 'lookup_order', arguments: { order_id: 'A-104' } }, parentId: 'order-input' },
      { id: 'order-result-event', sequence: 3, type: 'tool_result', at: demoTime, label: 'Fixture returned', payload: { tool_call_id: 'order-tool', outcome: 'ok', content: { status: 'shipped' } }, parentId: 'order-call' },
      { id: 'order-answer', sequence: 4, type: 'assistant_message', at: demoTime, label: 'Assistant answer', payload: { role: 'assistant', content: 'Order A-104 has shipped.' }, parentId: 'order-result-event' },
    ], results: [{ id: 'order-result', type: 'Tool sequence', verdict: 'pass', summary: 'Expected tool was called.', expected: 'lookup_order', actual: 'lookup_order', eventIds: ['order-call'], required: true }] },
  ],
}

for (const run of demoWorkspace.runs) {
  run.caseSnapshot = structuredClone(demoWorkspace.cases.find(testCase => testCase.id === run.caseId))
  run.profileSnapshot = structuredClone(demoWorkspace.profiles.find(profile => profile.id === run.profileId))
}

export const emptyWorkspace = (): Workspace => ({ suites: [], cases: [], profiles: [], runs: [] })

export function createDemoRun(testCase: TestCase, profile: Profile, runSetId: string): Run {
  const runId = id()
  return {
    id: runId, runSetId, caseId: testCase.id, caseKey: testCase.caseKey, caseName: testCase.name, revision: testCase.revision,
    profileId: profile.id, profileName: profile.name, model: profile.model, source: 'executed', status: 'queued', verdict: 'pending',
    createdAt: now(), durationMs: null, events: [], results: [], caseSnapshot: structuredClone(testCase), profileSnapshot: structuredClone(profile),
  }
}

export function completeDemoRun(run: Run, testCase: TestCase): Run {
  const time = now()
  const answer = testCase.caseKey === 'weather.basic' ? 'It is clear and 22°C in Tokyo.' : testCase.caseKey === 'order.status' ? 'Order A-104 has shipped.' : 'No policy text was supplied.'
  const tools = JSON.parse(testCase.fixtureTools) as { name: string; fixtures?: { arguments?: unknown; result?: unknown }[] }[]
  const fixture = tools[0]
  const events: TraceEvent[] = [{ id: `${run.id}-input`, sequence: 1, type: 'input_message', at: time, label: 'User input', payload: { role: 'user', content: testCase.input } }]
  if (fixture) {
    events.push({ id: `${run.id}-call`, sequence: 2, type: 'tool_call', at: time, label: `${fixture.name} called`, payload: { tool_call_id: `${run.id}-tool`, tool_name: fixture.name, arguments: fixture.fixtures?.[0]?.arguments ?? {} }, parentId: `${run.id}-input` })
    events.push({ id: `${run.id}-result`, sequence: 3, type: 'tool_result', at: time, label: 'Fixture returned', payload: { tool_call_id: `${run.id}-tool`, outcome: 'ok', content: fixture.fixtures?.[0]?.result ?? {} }, parentId: `${run.id}-call` })
  }
  events.push({ id: `${run.id}-answer`, sequence: events.length + 1, type: 'assistant_message', at: time, label: 'Assistant answer', payload: { role: 'assistant', content: answer }, parentId: events[events.length - 1].id })
  const results: EvaluationResult[] = testCase.evaluators.map(evaluator => {
    const toolExpected = evaluator.type === 'tool_sequence'
    const actualTool = fixture?.name ?? '(no tool call)'
    const supported = evaluator.type !== 'json_schema'
    const passed = toolExpected ? actualTool === evaluator.expected : evaluator.type === 'exact_text' ? answer === evaluator.expected : answer.toLowerCase().includes(evaluator.expected.toLowerCase())
    return { id: id(), type: evaluator.type.replace('_', ' '), verdict: supported ? passed ? 'pass' : 'fail' : 'error', summary: supported ? passed ? 'Expected evidence found.' : 'Expected evidence was not found.' : 'JSON schema evaluation requires the backend.', expected: evaluator.expected, actual: toolExpected ? actualTool : answer, eventIds: supported ? [toolExpected && fixture ? `${run.id}-call` : `${run.id}-answer`] : [], required: evaluator.required }
  })
  const verdict = results.some(result => result.required && result.verdict === 'error') ? 'incomplete' : results.some(result => result.required && result.verdict === 'fail') ? 'fail' : 'pass'
  return { ...run, status: 'completed', verdict, durationMs: 920, events, results }
}
