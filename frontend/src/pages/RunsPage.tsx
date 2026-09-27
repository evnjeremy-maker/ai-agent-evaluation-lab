import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, EmptyState, PageHeading, formatDate } from '../components'
import { useLab } from '../store'

export function RunsPage() {
  const { workspace, update } = useLab()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const setFilter = params.get('set')
  const runs = workspace!.runs.filter(run => (!setFilter || run.runSetId === setFilter) && (status === 'all' || run.status === status) && `${run.caseKey} ${run.caseName} ${run.profileName}`.toLowerCase().includes(search.toLowerCase()))
  const active = workspace!.runs.filter(run => ['queued', 'running', 'evaluating'].includes(run.status)).length
  const groups = [...new Set(runs.map(run => run.runSetId))]
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= 5 ? current : [...current, id])
  const cancel = (id: string) => update(current => ({ ...current, runs: current.runs.map(run => run.id === id && ['queued', 'running', 'evaluating'].includes(run.status) ? { ...run, status: 'cancelled', verdict: 'skipped' } : run) }))

  return <>
    <PageHeading eyebrow="04 / RUN MONITOR" title="Runs" description="Follow queued work, inspect completed evidence, and compare compatible attempts." actions={<Link className="button button-primary" to="/launch">Launch run</Link>} />
    <div className="run-overview"><div><span className="eyebrow">TOTAL RUNS</span><strong>{workspace!.runs.length}</strong></div><div><span className="eyebrow">ACTIVE OR QUEUED</span><strong>{active}</strong></div><div><span className="eyebrow">COMPLETED</span><strong>{workspace!.runs.filter(run => run.status === 'completed').length}</strong></div></div>
    {setFilter && <div className="notice info">Showing run set <code>{setFilter.slice(0, 8)}</code>. <Link to="/runs">View all runs</Link></div>}
    <div className="runs-toolbar"><label className="search-field"><span className="sr-only">Search runs</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search case or profile" /></label><label className="filter-select"><span className="sr-only">Filter by status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="queued">Queued</option><option value="running">Running</option><option value="evaluating">Evaluating</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="failed">Failed</option><option value="timed_out">Timed out</option><option value="failed_interrupted">Interrupted</option></select></label>{selected.length >= 2 && <button className="button button-secondary" onClick={() => navigate(`/compare?${selected.map(id => `run_id=${encodeURIComponent(id)}`).join('&')}`)}>Compare {selected.length} runs</button>}</div>
    {workspace!.runs.length === 0 ? <EmptyState title="No runs yet" description="Launch a FakeProvider run or import a trace to begin inspecting evidence." action={<Link className="button button-primary" to="/launch">Launch first run</Link>} /> : runs.length === 0 ? <EmptyState title="No matching runs" description="Change the search or status filter to find a run." /> : groups.map(group => <section key={group} className="run-group"><div className="section-title-row"><h2>Run set <code>{group.slice(0, 8)}</code></h2><span className="count">{runs.filter(run => run.runSetId === group).length}</span></div><div className="table-scroll"><table className="data-table runs-table"><thead><tr><th scope="col"><span className="sr-only">Select for comparison</span></th><th scope="col">Case</th><th scope="col">Source</th><th scope="col">Profile / model</th><th scope="col">State</th><th scope="col">Deterministic</th><th scope="col">Started</th><th scope="col">Duration</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody>{runs.filter(run => run.runSetId === group).map(run => <tr key={run.id}><td><input type="checkbox" aria-label={`Select ${run.caseKey} for comparison`} checked={selected.includes(run.id)} disabled={!selected.includes(run.id) && selected.length >= 5} onChange={() => toggle(run.id)} /></td><td><Link className="table-primary" to={`/runs/${run.id}`}>{run.caseName}</Link><span className="table-description"><code>{run.caseKey}</code> · r{run.revision}</span></td><td>{run.source}</td><td>{run.profileName}<span className="table-description">{run.model}</span></td><td><Badge value={run.status} /></td><td><Badge value={run.verdict} /></td><td>{formatDate(run.createdAt)}</td><td>{run.durationMs === null ? 'Unavailable' : `${run.durationMs} ms`}</td><td>{['queued', 'running', 'evaluating'].includes(run.status) ? <button className="text-button danger-text" onClick={() => cancel(run.id)}>Cancel</button> : <Link className="text-button" to={`/runs/${run.id}`}>Inspect</Link>}</td></tr>)}</tbody></table></div></section>)}
    <p className="table-footnote">Select 2 to 5 runs to compare. Ties and unavailable values remain visible.</p>
  </>
}
