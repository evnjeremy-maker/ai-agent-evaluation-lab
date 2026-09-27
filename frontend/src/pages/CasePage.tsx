import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState, PageHeading, formatDate } from '../components'
import { id, now, type Evaluator, type TestCase } from '../model'
import { useLab } from '../store'

type Message = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }

function parseTools(source: string): string | null {
  try {
    const value: unknown = JSON.parse(source)
    if (!Array.isArray(value)) return 'Fixture tools must be a JSON array.'
    const names = value.map(item => typeof item === 'object' && item !== null && 'name' in item ? (item as { name: unknown }).name : null)
    if (names.some(name => typeof name !== 'string' || !name.trim())) return 'Each fixture tool needs a non-empty name.'
    if (new Set(names).size !== names.length) return 'Fixture tool names must be unique.'
    return null
  } catch { return 'Fixture tools must contain valid JSON.' }
}

export function CasePage() {
  const { caseId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { workspace, update } = useLab()
  const existing = workspace!.cases.find(item => item.id === caseId)
  const isNew = caseId === undefined
  const suiteId = existing?.suiteId ?? params.get('suite') ?? workspace!.suites[0]?.id
  const suite = workspace!.suites.find(item => item.id === suiteId)
  const [editing, setEditing] = useState(isNew)
  const [dirty, setDirty] = useState(false)
  const [name, setName] = useState(existing?.name ?? '')
  const [caseKey, setCaseKey] = useState(existing?.caseKey ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [messages, setMessages] = useState<Message[]>(existing?.messages ?? [{ role: 'user', content: existing?.input ?? '' }])
  const [fixtureTools, setFixtureTools] = useState(existing?.fixtureTools ?? '[]')
  const [evaluators, setEvaluators] = useState<Evaluator[]>(existing?.evaluators ?? [{ id: id(), type: 'contains', expected: '', required: true }])
  const [judgeRubric, setJudgeRubric] = useState(existing?.judgeRubric ?? '')
  const [errors, setErrors] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const onLink = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      if (anchor && anchor.origin === location.origin && !window.confirm('Discard unsaved case changes?')) event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onLink, true)
    return () => { window.removeEventListener('beforeunload', onBeforeUnload); document.removeEventListener('click', onLink, true) }
  }, [dirty])

  const mark = () => { setDirty(true); setSaved(false) }
  const changeMessage = (index: number, patch: Partial<Message>) => { setMessages(current => current.map((message, position) => position === index ? { ...message, ...patch } : message)); mark() }
  const changeEvaluator = (index: number, patch: Partial<Evaluator>) => { setEvaluators(current => current.map((evaluator, position) => position === index ? { ...evaluator, ...patch } : evaluator)); mark() }

  const save = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: string[] = []
    if (!suite) nextErrors.push('Select a suite before saving.')
    if (!name.trim()) nextErrors.push('Case name is required.')
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(caseKey.trim())) nextErrors.push('Case key must use letters, numbers, dots, underscores, or hyphens.')
    if (workspace!.cases.some(item => item.suiteId === suiteId && item.caseKey === caseKey.trim() && item.id !== existing?.id)) nextErrors.push('Case key is already used in this suite.')
    if (!messages.some(message => message.role === 'user' && message.content.trim())) nextErrors.push('Add a user message with content.')
    const toolError = parseTools(fixtureTools)
    if (toolError) nextErrors.push(toolError)
    if (evaluators.some(evaluator => !evaluator.expected.trim())) nextErrors.push('Each evaluator needs an expected value.')
    setErrors(nextErrors)
    if (nextErrors.length || !suite) return
    const date = now()
    const next: TestCase = {
      id: existing?.id ?? id(), suiteId: suite.id, caseKey: caseKey.trim(), name: name.trim(), description: description.trim(),
      revision: existing ? existing.revision + 1 : 1, input: messages.find(message => message.role === 'user')!.content,
      messages, fixtureTools: JSON.stringify(JSON.parse(fixtureTools), null, 2), evaluators, judgeRubric, updatedAt: date,
      history: existing ? [...(existing.history ?? []), { revision: existing.revision, savedAt: existing.updatedAt, input: existing.input, fixtureTools: existing.fixtureTools, evaluators: existing.evaluators }] : [],
    }
    update(current => ({ ...current, cases: existing ? current.cases.map(item => item.id === existing.id ? next : item) : [...current.cases, next] }))
    setDirty(false); setSaved(true); setEditing(false)
    if (isNew) navigate(`/cases/${next.id}`, { replace: true })
  }

  if (!suite) return <EmptyState title="Create a suite first" description="Cases belong to a suite." action={<Link className="button button-primary" to="/suites">Open suites</Link>} />
  if (!isNew && !existing) return <EmptyState title="Case not found" description="This case is not in the local preview." action={<Link className="button button-secondary" to="/suites">Open suites</Link>} />

  return <>
    <div className="back-link"><Link to="/suites">← Suites & cases</Link><span>/</span><span>{suite.name}</span></div>
    <PageHeading eyebrow={`CASE EDITOR / ${existing ? `REVISION ${existing.revision}` : 'NEW CASE'}`} title={isNew ? 'Create test case' : existing!.name} description="Define the input, fixture tools, and checks that produce an explainable verdict." actions={!editing && <button className="button button-primary" onClick={() => setEditing(true)}>Edit draft</button>} />
    {saved && <div className="notice success" role="status">Revision saved. The previous revision is retained in this preview's history.</div>}
    {errors.length > 0 && <div className="notice error" role="alert"><strong>Fix these fields before saving</strong><ul>{errors.map(message => <li key={message}>{message}</li>)}</ul></div>}
    <form onSubmit={save} className="editor-layout">
      <div className="editor-main">
        <section className="panel"><div className="panel-heading"><span className="panel-index">01</span><div><h2>Case identity</h2><p>Name and stable key within {suite.name}.</p></div></div><div className="field-grid"><label>Case name<input value={name} onChange={event => { setName(event.target.value); mark() }} disabled={!editing} maxLength={120} required /></label><label>Case key<input value={caseKey} onChange={event => { setCaseKey(event.target.value); mark() }} disabled={!editing || !!existing} placeholder="weather.basic" required /><small>Stable after creation.</small></label></div><label>Description<textarea value={description} onChange={event => { setDescription(event.target.value); mark() }} disabled={!editing} rows={2} /></label></section>
        <section className="panel"><div className="panel-heading"><span className="panel-index">02</span><div><h2>Input messages</h2><p>Ordered messages sent to the agent.</p></div></div><div className="stack-list">{messages.map((message, index) => <div className="message-editor" key={index}><div className="message-head"><span className="eyebrow">MESSAGE {String(index + 1).padStart(2, '0')}</span>{editing && messages.length > 1 && <button type="button" className="text-button danger-text" onClick={() => { setMessages(current => current.filter((_, position) => position !== index)); mark() }}>Remove</button>}</div><div className="field-grid narrow"><label>Role<select value={message.role} onChange={event => changeMessage(index, { role: event.target.value as Message['role'] })} disabled={!editing}><option value="user">User</option><option value="system">System</option><option value="assistant">Assistant</option><option value="tool">Tool</option></select></label><label>Content<textarea value={message.content} onChange={event => changeMessage(index, { content: event.target.value })} disabled={!editing} rows={3} /></label></div></div>)}</div>{editing && <button type="button" className="button button-secondary" onClick={() => { setMessages(current => [...current, { role: 'user', content: '' }]); mark() }}>Add message</button>}</section>
        <section className="panel"><div className="panel-heading"><span className="panel-index">03</span><div><h2>Fixture tools</h2><p>Only declared fixtures can respond during a run.</p></div></div><label>Tool definitions (JSON)<textarea className="code-input" value={fixtureTools} onChange={event => { setFixtureTools(event.target.value); mark() }} disabled={!editing} rows={8} spellCheck={false} /></label><p className="field-help">Use an array of tool objects with unique <code>name</code> values. JSON is validated before saving.</p></section>
        <section className="panel"><div className="panel-heading"><span className="panel-index">04</span><div><h2>Deterministic evaluators</h2><p>Required failures determine the final deterministic verdict.</p></div></div><div className="stack-list">{evaluators.map((evaluator, index) => <div className="evaluator-editor" key={evaluator.id}><div className="message-head"><span className="eyebrow">CHECK {String(index + 1).padStart(2, '0')}</span>{editing && <button type="button" className="text-button danger-text" onClick={() => { setEvaluators(current => current.filter(item => item.id !== evaluator.id)); mark() }}>Remove</button>}</div><div className="field-grid"><label>Evaluator type<select value={evaluator.type} onChange={event => changeEvaluator(index, { type: event.target.value as Evaluator['type'] })} disabled={!editing}><option value="contains">Contains text</option><option value="exact_text">Exact text</option><option value="tool_sequence">Tool sequence</option><option value="json_schema">JSON schema</option></select></label><label>Expected value<input value={evaluator.expected} onChange={event => changeEvaluator(index, { expected: event.target.value })} disabled={!editing} /></label></div><label className="checkbox-line"><input type="checkbox" checked={evaluator.required} onChange={event => changeEvaluator(index, { required: event.target.checked })} disabled={!editing} />Required for deterministic outcome</label></div>)}</div>{editing && <button type="button" className="button button-secondary" onClick={() => { setEvaluators(current => [...current, { id: id(), type: 'contains', expected: '', required: true }]); mark() }}>Add evaluator</button>}</section>
        <section className="panel"><div className="panel-heading"><span className="panel-index">05</span><div><h2>Experimental judge</h2><p>Optional rubric. Judge results stay separate from deterministic checks.</p></div></div><label>Rubric<textarea value={judgeRubric} onChange={event => { setJudgeRubric(event.target.value); mark() }} disabled={!editing} rows={3} placeholder="Leave empty to disable the experimental judge" /></label></section>
      </div>
      <aside className="editor-aside"><div className="aside-panel"><p className="eyebrow">REVISION STATUS</p><h3>{existing ? `Revision ${existing.revision}` : 'Unsaved case'}</h3><p>{editing ? dirty ? 'Draft changes have not been saved.' : 'Editing a new revision.' : 'This revision is read only. Edit to create the next version.'}</p>{existing && <p className="subtle">Saved {formatDate(existing.updatedAt)}</p>}{editing && <button className="button button-primary full-width" type="submit">Save as new revision</button>}</div><div className="aside-panel history-panel"><p className="eyebrow">REVISION HISTORY</p><ol>{existing?.history?.map(item => <li key={item.revision}><span>Revision {item.revision}</span><small>{formatDate(item.savedAt)}</small></li>)}{existing && <li className="current"><span>Revision {existing.revision}</span><small>Current</small></li>}{!existing && <li>History starts after the first save.</li>}</ol></div></aside>
    </form>
  </>
}
