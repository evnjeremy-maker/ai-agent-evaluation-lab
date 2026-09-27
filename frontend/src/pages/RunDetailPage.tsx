import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Badge, EmptyState, JsonDisclosure, Modal, PageHeading, formatDate } from '../components'
import { id, type Run } from '../model'
import { useLab } from '../store'

function exportDocument(run: Run): unknown | null {
  if (run.canonical) return run.canonical
  const testCase = run.caseSnapshot
  const profile = run.profileSnapshot
  if (!testCase || !profile) return null
  return {
    schema_version: '1.0',
    case_snapshot: { case_key: run.caseKey, name: run.caseName, revision_number: run.revision, input_messages: (testCase.messages ?? [{ role: 'user', content: testCase.input }]).map(message => ({ role: message.role, content: [{ type: 'text', text: message.content }] })), fixture_tools: JSON.parse(testCase.fixtureTools), evaluator_specs: testCase.evaluators },
    profile_snapshot: { provider_type: profile.providerType, base_url: profile.baseUrl || null, model: run.model, system_instructions: profile.systemInstructions, generation_config: { temperature: profile.temperature, max_tokens: profile.maxTokens }, credential_alias: profile.credentialAlias || null },
    runner_limits: {},
    run: { status: run.status, started_at: run.createdAt, ended_at: run.status === 'completed' ? run.createdAt : null, duration_ms: run.durationMs, usage: null, error: run.error ?? null },
    events: run.events.map(event => ({ event_id: event.id, sequence: event.sequence, type: event.type, occurred_at: event.at, duration_ms: null, parent_event_id: event.parentId ?? null, provider_request_id: null, payload: event.payload })),
  }
}

export function RunDetailPage() {
  const { runId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { workspace, update } = useLab()
  const run = workspace!.runs.find(item => item.id === runId)
  const [selectedResult, setSelectedResult] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteWord, setDeleteWord] = useState('')

  useEffect(() => {
    if (location.hash) window.setTimeout(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: 'center' }), 0)
  }, [location.hash, run?.events.length])

  if (!run) return <EmptyState title="Run not found" description="The run may have been deleted from this preview." action={<Link className="button button-secondary" to="/runs">Open runs</Link>} />
  const result = run.results.find(item => item.id === selectedResult) ?? run.results[0]
  const canonical = exportDocument(run)
  const copyCanonical = async () => {
    if (!canonical) return
    try { await navigator.clipboard.writeText(JSON.stringify(canonical, null, 2)); setFeedback('Redacted schema 1.0 JSON copied.') }
    catch { setFeedback('Clipboard unavailable. Use the download action instead.') }
  }
  const download = () => {
    if (!canonical) return
    const blob = new Blob([JSON.stringify(canonical, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `run-${run.id.slice(0, 8)}-redacted.json`; link.click()
    URL.revokeObjectURL(url)
    setFeedback('Redacted schema 1.0 JSON downloaded.')
  }
  const reevaluate = () => {
    update(current => ({ ...current, runs: current.runs.map(item => item.id === run.id ? { ...item, evaluationHistory: [...(item.evaluationHistory ?? []), item.results], results: item.results.map(entry => ({ ...entry, id: id() })) } : item) }))
    setSelectedResult(null); setFeedback('A new demo evaluation batch was created from stored evidence.')
  }
  const cancel = () => {
    update(current => ({ ...current, runs: current.runs.map(item => item.id === run.id ? { ...item, status: 'cancelled', verdict: 'skipped' } : item) }))
    setFeedback('Cancellation requested in the local preview.')
  }
  const remove = () => {
    if (deleteWord !== 'DELETE' || ['queued', 'running', 'evaluating'].includes(run.status)) return
    update(current => ({ ...current, runs: current.runs.filter(item => item.id !== run.id) }))
    setDeleteOpen(false); navigate('/runs')
  }

  return <>
    <div className="back-link"><Link to="/runs">← Runs</Link><span>/</span><span>{run.caseKey}</span></div>
    <PageHeading eyebrow={`RUN DETAIL / ${run.source.toUpperCase()}`} title={run.caseName} description={<span>Stored snapshot for <code>{run.caseKey}</code>, revision {run.revision}.</span>} actions={<div className="inline-actions"><Link className="button button-secondary" to={`/compare?run_id=${encodeURIComponent(run.id)}`}>Compare</Link>{['queued', 'running', 'evaluating'].includes(run.status) && <button className="button button-danger" onClick={cancel}>Cancel run</button>}</div>} />
    {feedback && <div className="notice success" role="status">{feedback}</div>}
    <div className="run-status-strip"><div><span className="eyebrow">EXECUTION</span><Badge value={run.status} /></div><div><span className="eyebrow">DETERMINISTIC</span><Badge value={run.verdict} /></div><div><span className="eyebrow">PROFILE / MODEL</span><strong>{run.profileName} · {run.model}</strong></div><div><span className="eyebrow">STARTED / DURATION</span><strong>{formatDate(run.createdAt)} · {run.durationMs === null ? 'Unavailable' : `${run.durationMs} ms`}</strong></div></div>
    {run.status !== 'completed' && <div className="notice info" role="status">{run.status === 'cancelled' ? 'This run was cancelled. Any committed partial trace remains below.' : run.status === 'failed_interrupted' ? 'Execution was interrupted. Partial evidence remains available.' : run.status === 'timed_out' ? 'The run timed out. Partial evidence remains available.' : run.status === 'failed' ? 'Execution failed. This is separate from evaluator results.' : 'Run is active. This preview updates its status automatically.'}</div>}
    <div className="detail-layout"><div className="detail-main"><section className="panel"><div className="section-title-row"><div><p className="eyebrow">EVALUATION</p><h2>Deterministic checks</h2></div>{run.results.length > 0 && run.source === 'executed' && <button className="button button-secondary" onClick={reevaluate}>Re-evaluate stored run</button>}</div>{run.results.length === 0 ? <p className="muted">{run.source === 'imported' ? 'This imported preview has no server evaluation. The trace is available below.' : 'Evaluation has not completed yet.'}</p> : <div className="evaluation-list">{run.results.map((item, index) => <button id={`result-${item.id}`} key={item.id} className={`evaluation-row${result?.id === item.id ? ' selected' : ''}`} onClick={() => setSelectedResult(item.id)}><span className="result-index">{String(index + 1).padStart(2, '0')}</span><span className="result-body"><strong>{item.type}</strong><small>{item.summary}</small></span><Badge value={item.verdict} /></button>)}</div>}{run.evaluationHistory && run.evaluationHistory.length > 0 && <p className="field-help">{run.evaluationHistory.length} previous evaluation batch{run.evaluationHistory.length === 1 ? '' : 'es'} retained in this preview.</p>}</section>
        <section className="panel trace-panel"><div className="section-title-row"><div><p className="eyebrow">EXECUTION EVIDENCE</p><h2>Trace timeline</h2></div><span className="count">{run.events.length} events</span></div>{run.events.length === 0 ? <p className="muted">No trace events have been committed yet.</p> : <ol className="trace-list">{run.events.map(event => <li key={event.id} id={`event-${event.id}`} className="trace-event"><div className="trace-track"><span className="trace-node" /><span className="trace-line" /></div><div className="trace-content"><div className="trace-head"><span><span className="trace-sequence">{String(event.sequence).padStart(2, '0')}</span><strong>{event.label}</strong></span><span className="trace-type">{event.type.replaceAll('_', ' ')}</span></div><div className="trace-meta"><code>{event.id}</code>{event.parentId && <a href={`#event-${event.parentId}`}>Parent event</a>}<span>{formatDate(event.at)}</span></div><JsonDisclosure value={event.payload} label="View payload" /></div></li>)}</ol>}</section></div>
      <aside className="detail-aside"><div className="aside-panel evidence-panel"><p className="eyebrow">SELECTED EVIDENCE</p>{result ? <><h3>{result.type}</h3><Badge value={result.verdict} /><p>{result.summary}</p><dl className="detail-list"><div><dt>Expected</dt><dd><code>{result.expected}</code></dd></div><div><dt>Actual</dt><dd><code>{result.actual}</code></dd></div><div><dt>Required</dt><dd>{result.required ? 'Yes' : 'No'}</dd></div></dl><p className="eyebrow">LINKED EVENTS</p>{result.eventIds.length ? result.eventIds.map(eventId => <a className="evidence-link" key={eventId} href={`#event-${eventId}`}>{eventId} ↗</a>) : <p className="muted">No event pointer.</p>}</> : <p className="muted">Select a deterministic check to inspect its evidence.</p>}</div><div className="aside-panel"><p className="eyebrow">EXPERIMENTAL JUDGE</p><h3>Not requested</h3><p>Probabilistic judging is separate from deterministic results.</p></div><div className="aside-panel data-actions"><p className="eyebrow">RUN DATA</p><p>Export uses canonical schema 1.0. Preview data is synthetic or redacted in memory.</p>{canonical !== null && <><button className="text-button" onClick={copyCanonical}>Copy canonical JSON</button><button className="text-button" onClick={download}>Download redacted export</button></>}<button className="text-button danger-text" onClick={() => { setDeleteWord(''); setDeleteOpen(true) }}>Delete run data</button></div></aside></div>
    {deleteOpen && <Modal title="Delete run data?" description={`This removes 1 run, ${run.events.length} trace events, and ${run.results.length} current evaluator results from the preview. Type DELETE to confirm.`} onClose={() => setDeleteOpen(false)}><label>Confirmation<input autoFocus value={deleteWord} onChange={event => setDeleteWord(event.target.value)} placeholder="DELETE" /></label>{['queued', 'running', 'evaluating'].includes(run.status) && <p className="field-error" role="alert">Active work must be cancelled before deletion.</p>}<div className="modal-footer"><button className="button button-secondary" onClick={() => setDeleteOpen(false)}>Keep run</button><button className="button button-danger" disabled={deleteWord !== 'DELETE' || ['queued', 'running', 'evaluating'].includes(run.status)} onClick={remove}>Delete run data</button></div></Modal>}
  </>
}
