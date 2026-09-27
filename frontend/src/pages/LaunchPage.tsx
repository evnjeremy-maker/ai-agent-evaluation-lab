import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, PageHeading } from '../components'
import { createDemoRun, id, now, type Run, type RunStatus, type TraceEvent } from '../model'
import { useLab } from '../store'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_EVENTS = 10000
const requiredFields = ['schema_version', 'case_snapshot', 'profile_snapshot', 'runner_limits', 'run', 'events']
const sensitiveKey = /authorization|credential|password|secret|token|api.?key|cookie/i

export function redact(value: unknown, key = ''): unknown {
  if (sensitiveKey.test(key)) return '[REDACTED]'
  if (Array.isArray(value)) return value.map(item => redact(item))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)]))
  if (typeof value === 'string') return value.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@').replace(/([?&](?:api[_-]?key|access[_-]?token|credential|key|token|secret|password)=)[^&\s]+/gi, '$1[REDACTED]')
  return value
}

type CanonicalPreview = { schema_version: string; source_label?: string; case_snapshot: { case_key: string; name?: string; revision_number?: number }; profile_snapshot: { model?: string }; run: { status: string; duration_ms?: number }; events: { event_id: string; sequence: number; type: string; occurred_at: string; parent_event_id?: string | null; payload: unknown }[] }

export function validateImport(value: unknown): { errors: string[]; document?: CanonicalPreview } {
  const errors: string[] = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { errors: ['/: expected a JSON object.'] }
  const document = value as Record<string, unknown>
  for (const field of requiredFields) if (!(field in document)) errors.push(`/${field}: required field is missing.`)
  for (const field of Object.keys(document)) if (![...requiredFields, 'source_label'].includes(field)) errors.push(`/${field}: unknown field.`)
  if (document.source_label !== undefined && typeof document.source_label !== 'string') errors.push('/source_label: expected a string.')
  if (document.schema_version !== '1.0') errors.push('/schema_version: only version 1.0 is supported.')
  if (!document.case_snapshot || typeof document.case_snapshot !== 'object' || typeof (document.case_snapshot as Record<string, unknown>).case_key !== 'string') errors.push('/case_snapshot/case_key: expected a string.')
  if (!document.profile_snapshot || typeof document.profile_snapshot !== 'object') errors.push('/profile_snapshot: expected an object.')
  if (!document.runner_limits || typeof document.runner_limits !== 'object' || Array.isArray(document.runner_limits)) errors.push('/runner_limits: expected an object.')
  if (!document.run || typeof document.run !== 'object') errors.push('/run: expected an object.')
  else {
    const run = document.run as Record<string, unknown>
    if (!['completed', 'cancelled', 'failed', 'timed_out', 'failed_interrupted'].includes(run.status as string)) errors.push('/run/status: expected a terminal run state.')
    if (run.duration_ms !== undefined && run.duration_ms !== null && (typeof run.duration_ms !== 'number' || run.duration_ms < 0)) errors.push('/run/duration_ms: expected a non-negative number or null.')
  }
  if (!Array.isArray(document.events)) errors.push('/events: expected an array.')
  else {
    if (document.events.length > MAX_EVENTS) errors.push(`/events: exceeds ${MAX_EVENTS.toLocaleString()} events.`)
    const seen = new Set<string>()
    let lastSequence = 0
    document.events.slice(0, MAX_EVENTS).forEach((event, index) => {
      if (!event || typeof event !== 'object') { errors.push(`/events/${index}: expected an object.`); return }
      const item = event as Record<string, unknown>
      if (typeof item.event_id !== 'string' || !item.event_id) errors.push(`/events/${index}/event_id: expected an ID.`)
      if (!Number.isInteger(item.sequence) || (item.sequence as number) <= lastSequence) errors.push(`/events/${index}/sequence: must increase strictly.`)
      if (typeof item.type !== 'string' || !item.type) errors.push(`/events/${index}/type: expected a type.`)
      if (typeof item.occurred_at !== 'string' || Number.isNaN(Date.parse(item.occurred_at))) errors.push(`/events/${index}/occurred_at: expected a timestamp.`)
      if (!('payload' in item)) errors.push(`/events/${index}/payload: required field is missing.`)
      if (typeof item.sequence === 'number') lastSequence = item.sequence
      if (typeof item.parent_event_id === 'string' && !seen.has(item.parent_event_id)) errors.push(`/events/${index}/parent_event_id: must reference an earlier event.`)
      if (typeof item.event_id === 'string') { if (seen.has(item.event_id)) errors.push(`/events/${index}/event_id: duplicate ID.`); seen.add(item.event_id) }
    })
  }
  return errors.length ? { errors } : { errors, document: value as CanonicalPreview }
}

export function LaunchPage() {
  const { workspace, update } = useLab()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'execute' | 'import'>('execute')
  const [suiteId, setSuiteId] = useState(workspace!.suites[0]?.id ?? '')
  const [profileId, setProfileId] = useState(workspace!.profiles[0]?.id ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'reading' | 'validating' | 'valid' | 'invalid' | 'importing'>('idle')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [preview, setPreview] = useState<CanonicalPreview | null>(null)
  const [sourceLabel, setSourceLabel] = useState('')
  const submitting = useRef(false)
  const suite = workspace!.suites.find(item => item.id === suiteId)
  const cases = workspace!.cases.filter(item => item.suiteId === suiteId)
  const profile = workspace!.profiles.find(item => item.id === profileId)

  const chooseSuite = (value: string) => { setSuiteId(value); setSelectedIds([]); setError('') }
  const toggleCase = (caseId: string) => setSelectedIds(current => current.includes(caseId) ? current.filter(item => item !== caseId) : [...current, caseId])
  const launch = () => {
    if (submitting.current) return
    if (!profile || profile.providerType !== 'fake') { setError('Select a FakeProvider profile for this local preview.'); return }
    if (!selectedIds.length) { setError('Select at least one case to launch.'); return }
    if (selectedIds.length > 200) { setError('A run set can contain at most 200 cases.'); return }
    submitting.current = true
    const runSetId = id()
    const runs = cases.filter(item => selectedIds.includes(item.id)).map(item => createDemoRun(item, profile, runSetId))
    update(current => ({ ...current, runs: [...runs, ...current.runs] }))
    navigate(`/runs?set=${runSetId}`)
  }

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    setFile(selected); setPreview(null); setImportErrors([]); setImportStatus('idle')
    if (!selected) return
    if (selected.size > MAX_FILE_BYTES) { setImportErrors(['/file: exceeds the 10 MiB limit.']); setImportStatus('invalid'); return }
    setImportStatus('reading')
    try {
      const content = await selected.text()
      setImportStatus('validating')
      const parsed: unknown = JSON.parse(content)
      const result = validateImport(parsed)
      setImportErrors(result.errors)
      setPreview(result.document ? redact(result.document) as CanonicalPreview : null)
      setImportStatus(result.document ? 'valid' : 'invalid')
    } catch { setImportErrors(['/file: malformed JSON or unreadable file.']); setImportStatus('invalid') }
  }

  const importTrace = () => {
    if (!preview || importStatus !== 'valid') return
    setImportStatus('importing')
    const runId = id()
    const events: TraceEvent[] = preview.events.map(item => ({ id: item.event_id, sequence: item.sequence, type: item.type, at: item.occurred_at, label: item.type.replaceAll('_', ' '), payload: redact(item.payload), parentId: item.parent_event_id ?? undefined }))
    const run: Run = { id: runId, runSetId: id(), caseId: '', caseKey: preview.case_snapshot.case_key, caseName: preview.case_snapshot.name || preview.case_snapshot.case_key, revision: preview.case_snapshot.revision_number || 1, profileId: '', profileName: 'Imported snapshot', model: preview.profile_snapshot.model || 'Unknown model', source: 'imported', status: preview.run.status as RunStatus, verdict: 'skipped', createdAt: now(), durationMs: preview.run.duration_ms ?? null, events, results: [], schemaVersion: '1.0', canonical: redact({ ...preview, source_label: sourceLabel || preview.source_label }) }
    update(current => ({ ...current, runs: [run, ...current.runs] }))
    navigate(`/runs/${runId}`)
  }

  return <>
    <PageHeading eyebrow="03 / EXECUTION" title="Launch a run" description="Choose a versioned test set, or inspect a canonical trace without executing its contents." />
    <div className="mode-switch" role="group" aria-label="Launch mode"><button type="button" aria-pressed={mode === 'execute'} className={mode === 'execute' ? 'active' : ''} onClick={() => setMode('execute')}>Execute cases</button><button type="button" aria-pressed={mode === 'import'} className={mode === 'import' ? 'active' : ''} onClick={() => setMode('import')}>Import trace</button></div>
    {mode === 'execute' ? <div className="launch-layout"><div className="launch-main"><section className="panel"><div className="panel-heading"><span className="panel-index">01</span><div><h2>Select test cases</h2><p>Each selected case creates one immutable run snapshot.</p></div></div>{workspace!.suites.length === 0 ? <EmptyState title="No suites yet" description="Create a suite and at least one case before launching." /> : <><label>Suite<select value={suiteId} onChange={event => chooseSuite(event.target.value)}>{workspace!.suites.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{cases.length === 0 ? <p className="muted">This suite has no cases. Add a case in the library.</p> : <div className="selection-list"><label className="selection-all"><input type="checkbox" checked={selectedIds.length === cases.length && cases.length > 0} onChange={event => setSelectedIds(event.target.checked ? cases.map(item => item.id) : [])} />Select all {cases.length} cases</label>{cases.map(item => <label className="case-selection" key={item.id}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleCase(item.id)} /><span><strong>{item.name}</strong><small><code>{item.caseKey}</code> · revision {item.revision} · {item.evaluators.length} checks</small></span></label>)}</div>}</>}</section><section className="panel"><div className="panel-heading"><span className="panel-index">02</span><div><h2>Agent profile</h2><p>The profile settings are copied into each run snapshot.</p></div></div>{workspace!.profiles.length === 0 ? <p className="muted">Create an agent profile before launching.</p> : <label>Profile<select value={profileId} onChange={event => setProfileId(event.target.value)}>{workspace!.profiles.map(item => <option key={item.id} value={item.id}>{item.name} · {item.model}</option>)}</select></label>}{profile && <div className="snapshot-line"><span>Provider</span><strong>{profile.providerType === 'fake' ? 'FakeProvider' : 'OpenAI-compatible'}</strong><span>Model</span><strong>{profile.model}</strong><span>Credential</span><strong>{profile.credentialAlias || 'None'}</strong></div>}</section><section className="panel"><div className="panel-heading"><span className="panel-index">03</span><div><h2>Optional judge</h2><p>Experimental and probabilistic results stay separate from deterministic checks.</p></div></div><p className="muted">External judging requires a configured backend and explicit data-sharing confirmation. It is unavailable in this local preview.</p></section></div><aside className="launch-aside"><div className="aside-panel launch-summary"><p className="eyebrow">RUN SNAPSHOT</p><h2>{selectedIds.length} <span>{selectedIds.length === 1 ? 'run' : 'runs'}</span></h2><div className="summary-rule" /><dl><div><dt>Suite</dt><dd>{suite?.name || 'None'}</dd></div><div><dt>Profile</dt><dd>{profile?.name || 'None'}</dd></div><div><dt>Execution</dt><dd>Serial queue</dd></div><div><dt>Judge</dt><dd>Off</dd></div></dl><p className="limit-note">Limits: up to 200 selected cases. Only fixture tools run in this preview.</p>{error && <p className="field-error" role="alert">{error}</p>}<button className="button button-primary full-width" onClick={launch}>Launch run set</button></div></aside></div> : <div className="import-layout"><section className="panel"><div className="panel-heading"><span className="panel-index">01</span><div><h2>Canonical trace file</h2><p>Validate a UTF-8 JSON document using schema version 1.0.</p></div></div><label>JSON file<input type="file" accept=".json,application/json" onChange={readFile} /></label><div className="import-limits"><span>Maximum file size <strong>10 MiB</strong></span><span>Maximum events <strong>10,000</strong></span><span>Supported schema <strong>1.0</strong></span></div><label>Source label (optional)<input value={sourceLabel} onChange={event => setSourceLabel(event.target.value)} placeholder="Local trace sample" /></label><p className="field-help">Trace content is treated as untrusted text. This preview only stores a redacted in-memory view and does not execute imported content.</p></section><aside className="panel import-result"><p className="eyebrow">VALIDATION</p>{importStatus === 'idle' ? <EmptyState title="No file selected" description="Select a canonical JSON file to preview validation." /> : importStatus === 'reading' || importStatus === 'validating' ? <p role="status">{importStatus === 'reading' ? 'Reading file…' : 'Validating document…'}</p> : importStatus === 'invalid' ? <div role="alert"><h2>Import needs changes</h2><ul className="validation-list">{importErrors.map(message => <li key={message}><code>{message}</code></li>)}</ul></div> : <><div className="notice success" role="status">Client preview checks passed. Server validation is still required for production imports.</div><dl className="detail-list"><div><dt>File</dt><dd>{file?.name}</dd></div><div><dt>Case key</dt><dd>{preview?.case_snapshot.case_key}</dd></div><div><dt>Events</dt><dd>{preview?.events.length}</dd></div><div><dt>Source</dt><dd>{sourceLabel || 'Unlabeled'}</dd></div></dl><button className="button button-primary full-width" onClick={importTrace}>Open imported preview</button></>}</aside></div>}
  </>
}
