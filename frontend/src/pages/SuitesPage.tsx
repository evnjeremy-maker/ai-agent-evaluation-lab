import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, Modal, PageHeading, formatDate } from '../components'
import { id, now, type Suite, type TestCase } from '../model'
import { useLab } from '../store'

type Dialog = 'create' | 'edit' | 'delete-suite' | 'duplicate' | 'delete-case' | null

export function SuitesPage() {
  const { workspace, update } = useLab()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [caseKey, setCaseKey] = useState('')
  const [targetCase, setTargetCase] = useState<TestCase | null>(null)
  const [error, setError] = useState('')
  const suites = workspace!.suites
  const selected = suites.find(suite => suite.id === selectedId) ?? suites[0]
  const cases = workspace!.cases.filter(testCase => testCase.suiteId === selected?.id)
  const visibleCases = cases.filter(testCase => `${testCase.name} ${testCase.caseKey}`.toLowerCase().includes(search.toLowerCase()))

  const openDialog = (next: Dialog, testCase?: TestCase) => {
    setDialog(next); setError(''); setTargetCase(testCase ?? null)
    setName(next === 'edit' ? selected?.name ?? '' : '')
    setDescription(next === 'edit' ? selected?.description ?? '' : '')
    setCaseKey(testCase ? `${testCase.caseKey}.copy` : '')
  }

  const saveSuite = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || name.trim().length > 120) { setError('Name must be 1 to 120 characters.'); return }
    if (description.length > 2000) { setError('Description must be 2,000 characters or fewer.'); return }
    if (dialog === 'edit' && selected) {
      update(current => ({ ...current, suites: current.suites.map(suite => suite.id === selected.id ? { ...suite, name: name.trim(), description: description.trim(), version: suite.version + 1, updatedAt: now() } : suite) }))
    } else {
      const suite: Suite = { id: id(), name: name.trim(), description: description.trim(), version: 1, updatedAt: now() }
      update(current => ({ ...current, suites: [...current.suites, suite] }))
      setSelectedId(suite.id)
    }
    setDialog(null)
  }

  const duplicateCase = (event: FormEvent) => {
    event.preventDefault()
    if (!targetCase || !selected) return
    const key = caseKey.trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(key)) { setError('Use letters, numbers, dots, underscores, or hyphens.'); return }
    if (cases.some(item => item.caseKey === key)) { setError('This case key already exists in the suite.'); return }
    const next: TestCase = { ...structuredClone(targetCase), id: id(), caseKey: key, name: `${targetCase.name} copy`, revision: 1, updatedAt: now(), evaluators: targetCase.evaluators.map(item => ({ ...item, id: id() })) }
    update(current => ({ ...current, cases: [...current.cases, next] }))
    setDialog(null)
    navigate(`/cases/${next.id}`)
  }

  const deleteSuite = () => {
    if (!selected) return
    update(current => ({ ...current, suites: current.suites.filter(item => item.id !== selected.id), cases: current.cases.filter(item => item.suiteId !== selected.id) }))
    setSelectedId(null); setDialog(null)
  }

  const deleteCase = () => {
    if (!targetCase) return
    update(current => ({ ...current, cases: current.cases.filter(item => item.id !== targetCase.id) }))
    setDialog(null)
  }

  return <>
    <PageHeading eyebrow="01 / TEST LIBRARY" title="Suites & cases" description="Keep each test definition versioned, inspectable, and ready to run." actions={<button className="button button-primary" onClick={() => openDialog('create')}>Create suite</button>} />
    {!selected ? <EmptyState title="Start with a suite" description="A suite groups related test cases. Create one to begin, or reload the synthetic demo workspace." action={<button className="button button-primary" onClick={() => openDialog('create')}>Create first suite</button>} /> : <div className="library-layout">
      <section className="suite-rail" aria-label="Suites"><div className="section-title-row"><h2>Suites</h2><span className="count">{suites.length}</span></div>
        <div className="suite-list">{suites.map(suite => <button key={suite.id} aria-pressed={suite.id === selected.id} className={`suite-option${suite.id === selected.id ? ' selected' : ''}`} onClick={() => setSelectedId(suite.id)}><span className="suite-option-name">{suite.name}</span><span className="suite-option-meta">{workspace!.cases.filter(item => item.suiteId === suite.id).length} cases</span></button>)}</div>
      </section>
      <section className="library-main">
        <div className="suite-summary"><div><p className="eyebrow">SELECTED SUITE / VERSION {selected.version}</p><h2>{selected.name}</h2><p>{selected.description || 'No description yet.'}</p><span className="subtle">Updated {formatDate(selected.updatedAt)}</span></div><div className="inline-actions"><button className="text-button" onClick={() => openDialog('edit')}>Edit suite</button><button className="text-button danger-text" onClick={() => openDialog('delete-suite')}>Delete suite</button></div></div>
        <div className="section-title-row case-heading"><div><h2>Test cases</h2><p className="muted">Search by case name or stable key.</p></div><Link className="button button-primary" to={`/cases/new?suite=${selected.id}`}>Create case</Link></div>
        {cases.length > 0 && <label className="search-field"><span className="sr-only">Search cases</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search cases" /></label>}
        {cases.length === 0 ? <EmptyState title="No cases in this suite" description="Create a case with input messages, fixture tools, and deterministic evaluators." action={<Link className="button button-secondary" to={`/cases/new?suite=${selected.id}`}>Create case</Link>} /> : visibleCases.length === 0 ? <EmptyState title="No matching cases" description="Try a different name or case key." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th scope="col">Case</th><th scope="col">Key</th><th scope="col">Revision</th><th scope="col">Updated</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleCases.map(testCase => <tr key={testCase.id}><td><Link className="table-primary" to={`/cases/${testCase.id}`}>{testCase.name}</Link><span className="table-description">{testCase.description || 'No description'}</span></td><td><code>{testCase.caseKey}</code></td><td>r{testCase.revision}</td><td>{formatDate(testCase.updatedAt)}</td><td><div className="table-actions"><button className="text-button" onClick={() => openDialog('duplicate', testCase)}>Duplicate</button><button className="text-button danger-text" onClick={() => openDialog('delete-case', testCase)}>Delete</button></div></td></tr>)}</tbody></table></div>}
      </section>
    </div>}

    {(dialog === 'create' || dialog === 'edit') && <Modal title={dialog === 'create' ? 'Create suite' : 'Edit suite'} onClose={() => setDialog(null)}><form onSubmit={saveSuite} className="form-stack"><label>Suite name<input autoFocus value={name} maxLength={120} onChange={event => setName(event.target.value)} required /></label><label>Description<textarea value={description} maxLength={2000} onChange={event => setDescription(event.target.value)} rows={3} /></label>{error && <p className="field-error" role="alert">{error}</p>}<div className="modal-footer"><button type="button" className="button button-secondary" onClick={() => setDialog(null)}>Cancel</button><button className="button button-primary" type="submit">{dialog === 'create' ? 'Create suite' : 'Save changes'}</button></div></form></Modal>}
    {dialog === 'duplicate' && targetCase && <Modal title="Duplicate case" description={`Copy ${targetCase.caseKey} into the selected suite with a new stable key.`} onClose={() => setDialog(null)}><form onSubmit={duplicateCase} className="form-stack"><label>New case key<input autoFocus value={caseKey} onChange={event => setCaseKey(event.target.value)} required /></label>{error && <p className="field-error" role="alert">{error}</p>}<div className="modal-footer"><button type="button" className="button button-secondary" onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="button button-primary">Duplicate case</button></div></form></Modal>}
    {dialog === 'delete-suite' && selected && <Modal title="Delete suite?" description={`${selected.name} and ${cases.length} current case definitions will be removed from this preview. ${workspace!.runs.filter(run => cases.some(item => item.id === run.caseId)).length} historical run snapshots remain visible.`} onClose={() => setDialog(null)} footer={<><button className="button button-secondary" onClick={() => setDialog(null)}>Keep suite</button><button className="button button-danger" onClick={deleteSuite}>Delete suite</button></>} />}
    {dialog === 'delete-case' && targetCase && <Modal title="Delete case?" description={`${targetCase.caseKey} will be removed from this preview. ${workspace!.runs.filter(run => run.caseId === targetCase.id).length} historical run snapshots remain visible.`} onClose={() => setDialog(null)} footer={<><button className="button button-secondary" onClick={() => setDialog(null)}>Keep case</button><button className="button button-danger" onClick={deleteCase}>Delete case</button></>} />}
  </>
}
