import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, EmptyState, PageHeading } from '../components'
import { useLab } from '../store'

export function ComparePage() {
  const { workspace } = useLab()
  const [params, setParams] = useSearchParams()
  const initial = params.getAll('run_id').filter(id => workspace!.runs.some(run => run.id === id)).slice(0, 5)
  const [selected, setSelected] = useState<string[]>(initial)
  const [pickerOpen, setPickerOpen] = useState(false)
  const runs = selected.map(id => workspace!.runs.find(run => run.id === id)).filter((run): run is NonNullable<typeof run> => !!run)
  const select = (id: string) => {
    const next = selected.includes(id) ? selected.filter(item => item !== id) : selected.length < 5 ? [...selected, id] : selected
    setSelected(next)
    setParams(next.map(item => ['run_id', item] as [string, string]))
  }
  const issues: string[] = []
  if (runs.length >= 2) {
    if (new Set(runs.map(run => run.caseKey)).size > 1) issues.push('Case keys differ')
    if (new Set(runs.map(run => run.revision)).size > 1) issues.push('Case revisions differ')
    if (new Set(runs.map(run => run.results.map(result => `${result.type}:${result.expected}`).join('|'))).size > 1) issues.push('Evaluator configurations differ')
    if (new Set(runs.map(run => run.model)).size > 1) issues.push('Models differ')
    if (new Set(runs.map(run => run.profileName)).size > 1) issues.push('Profiles differ')
    if (new Set(runs.map(run => run.source)).size > 1) issues.push('Run sources differ')
  }
  const compatible = runs.length >= 2 && issues.length === 0
  const uniqueCaseKeys = [...new Set(runs.map(run => run.caseKey))]

  return <>
    <PageHeading eyebrow="05 / REGRESSION ANALYSIS" title="Compare runs" description="Inspect 2 to 5 runs side by side. Incompatible metrics remain visible but cannot be ranked." actions={<button className="button button-secondary" onClick={() => setPickerOpen(value => !value)}>{pickerOpen ? 'Close run picker' : 'Select runs'}</button>} />
    {pickerOpen && <section className="panel compare-picker"><div className="section-title-row"><div><h2>Select runs</h2><p className="muted">Choose 2 to 5. Comparison updates immediately.</p></div><span className="count">{selected.length} selected</span></div>{workspace!.runs.length === 0 ? <p className="muted">No runs are available yet.</p> : <div className="picker-grid">{workspace!.runs.map(run => <label key={run.id} className="picker-option"><input type="checkbox" checked={selected.includes(run.id)} disabled={!selected.includes(run.id) && selected.length >= 5} onChange={() => select(run.id)} /><span><strong>{run.caseKey}</strong><small>{run.profileName} · r{run.revision}</small></span><Badge value={run.verdict} /></label>)}</div>}</section>}
    {runs.length < 2 ? <EmptyState title="Select at least two runs" description="Choose runs from the picker to inspect outcome, evidence, timing, and compatibility." action={<button className="button button-primary" onClick={() => setPickerOpen(true)}>Select runs</button>} /> : <>
      <div className={`compatibility-banner${compatible ? ' compatible' : ''}`} role="status"><div><p className="eyebrow">COMPATIBILITY</p><h2>{compatible ? 'Ready for like-for-like comparison' : 'Comparison has differences'}</h2><p>{compatible ? 'Case, revision, evaluator configuration, model, profile, and source match.' : 'Ranking is blocked for incompatible metrics. Inspect each run and its evidence below.'}</p></div><span className="compatibility-icon" aria-hidden="true">{compatible ? '✓' : '!'}</span></div>
      {issues.length > 0 && <div className="difference-list"><strong>Differences detected</strong><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      <section className="panel comparison-panel"><div className="section-title-row"><div><p className="eyebrow">ALIGNED BY CASE KEY</p><h2>Run comparison</h2></div><span className="count">{uniqueCaseKeys.length} case key{uniqueCaseKeys.length === 1 ? '' : 's'}</span></div><div className="table-scroll"><table className="comparison-table"><thead><tr><th scope="col">Metric</th>{runs.map((run, index) => <th key={run.id} scope="col"><span className="compare-column-label">RUN {String(index + 1).padStart(2, '0')}</span><Link to={`/runs/${run.id}`}>{run.caseName}</Link><button className="remove-compare" aria-label={`Remove run ${index + 1}`} onClick={() => select(run.id)}>×</button></th>)}</tr></thead><tbody><tr><th scope="row">Case key</th>{runs.map(run => <td key={run.id}><code>{run.caseKey}</code></td>)}</tr><tr><th scope="row">Revision</th>{runs.map(run => <td key={run.id}>r{run.revision}</td>)}</tr><tr><th scope="row">Source</th>{runs.map(run => <td key={run.id}>{run.source}</td>)}</tr><tr><th scope="row">Profile</th>{runs.map(run => <td key={run.id}>{run.profileName}</td>)}</tr><tr><th scope="row">Model</th>{runs.map(run => <td key={run.id}>{run.model}</td>)}</tr><tr className="highlight-row"><th scope="row">Deterministic verdict</th>{runs.map(run => <td key={run.id}><Badge value={run.verdict} />{!compatible && <span className="table-description">Not rankable</span>}</td>)}</tr><tr><th scope="row">Duration</th>{runs.map(run => <td key={run.id}>{run.durationMs === null ? 'Unavailable' : `${run.durationMs} ms`}</td>)}</tr><tr><th scope="row">Trace events</th>{runs.map(run => <td key={run.id}>{run.events.length}</td>)}</tr><tr><th scope="row">Cost</th>{runs.map(run => <td key={run.id}>Unavailable</td>)}</tr><tr><th scope="row">Experimental judge</th>{runs.map(run => <td key={run.id}>Not requested</td>)}</tr></tbody></table></div></section>
      <section className="comparison-cards" aria-label="Run details on small screens">{runs.map((run, index) => <article key={run.id} className="comparison-card"><span className="eyebrow">RUN {String(index + 1).padStart(2, '0')}</span><h2><Link to={`/runs/${run.id}`}>{run.caseName}</Link></h2><dl className="detail-list"><div><dt>Case key</dt><dd><code>{run.caseKey}</code></dd></div><div><dt>Revision</dt><dd>r{run.revision}</dd></div><div><dt>Source</dt><dd>{run.source}</dd></div><div><dt>Model</dt><dd>{run.model}</dd></div><div><dt>Verdict</dt><dd><Badge value={run.verdict} /></dd></div><div><dt>Duration</dt><dd>{run.durationMs === null ? 'Unavailable' : `${run.durationMs} ms`}</dd></div></dl><button className="text-button danger-text" onClick={() => select(run.id)}>Remove from comparison</button></article>)}</section>
      <section className="panel"><div className="section-title-row"><div><p className="eyebrow">EVALUATOR DETAIL</p><h2>Evidence by run</h2></div></div><div className="comparison-evidence">{runs.map(run => <div key={run.id}><h3><Link to={`/runs/${run.id}`}>{run.caseKey} · r{run.revision}</Link></h3>{run.results.length ? <ul>{run.results.map(result => <li key={result.id}><Badge value={result.verdict} /><span>{result.type}: {result.summary}</span><Link to={`/runs/${run.id}#result-${result.id}`}>Inspect evidence</Link></li>)}</ul> : <p className="muted">No evaluator results available.</p>}</div>)}</div></section>
    </>}
  </>
}
