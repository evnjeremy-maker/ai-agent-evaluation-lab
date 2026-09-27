import { useState, type FormEvent } from 'react'
import { EmptyState, Modal, PageHeading } from '../components'
import { id, type Profile, type ProviderType } from '../model'
import { useLab } from '../store'

const blank = (): Profile => ({ id: '', name: '', providerType: 'fake', baseUrl: '', model: 'fake-v1', systemInstructions: '', temperature: 0, maxTokens: 512, credentialAlias: '', version: 0 })

export function ProfilesPage() {
  const { workspace, update } = useLab()
  const profiles = workspace!.profiles
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '')
  const selected = profiles.find(item => item.id === selectedId) ?? profiles[0]
  const [draft, setDraft] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [check, setCheck] = useState<'idle' | 'checking' | 'success' | 'unavailable'>('idle')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const edit = draft ?? selected

  const startNew = () => { setDraft(blank()); setError(''); setCheck('idle') }
  const startEdit = () => { if (selected) { setDraft({ ...selected }); setError(''); setCheck('idle') } }
  const set = (patch: Partial<Profile>) => setDraft(current => current ? { ...current, ...patch } : current)

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!draft) return
    if (!draft.name.trim()) { setError('Profile name is required.'); return }
    if (!draft.model.trim()) { setError('Model is required.'); return }
    if (draft.providerType === 'openai_compatible') {
      try { const url = new URL(draft.baseUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid') }
      catch { setError('Enter a valid HTTP or HTTPS base URL.'); return }
    }
    if (draft.temperature < 0 || draft.temperature > 2 || !Number.isFinite(draft.temperature)) { setError('Temperature must be between 0 and 2.'); return }
    if (draft.maxTokens < 1 || draft.maxTokens > 100000) { setError('Max tokens must be between 1 and 100,000.'); return }
    const next = { ...draft, id: draft.id || id(), name: draft.name.trim(), model: draft.model.trim(), version: draft.version + 1 }
    update(current => ({ ...current, profiles: draft.id ? current.profiles.map(item => item.id === draft.id ? next : item) : [...current.profiles, next] }))
    setSelectedId(next.id); setDraft(null); setError(''); setCheck('idle')
  }

  const checkConnection = () => {
    if (!edit) return
    setCheck('checking')
    window.setTimeout(() => setCheck(edit.providerType === 'fake' ? 'success' : 'unavailable'), 500)
  }

  const remove = () => {
    if (!selected) return
    update(current => ({ ...current, profiles: current.profiles.filter(item => item.id !== selected.id) }))
    setSelectedId(''); setDeleteOpen(false)
  }

  return <>
    <PageHeading eyebrow="02 / AGENT CONFIGURATION" title="Agent profiles" description="Configure how an agent runs without putting credentials in the browser." actions={<button className="button button-primary" onClick={startNew}>Create profile</button>} />
    <div className="profile-layout"><section className="profile-list"><div className="section-title-row"><h2>Profiles</h2><span className="count">{profiles.length}</span></div>{profiles.length === 0 ? <p className="muted">No profiles yet.</p> : profiles.map(profile => <button key={profile.id} aria-pressed={selected?.id === profile.id} className={`profile-option${selected?.id === profile.id ? ' selected' : ''}`} onClick={() => { setSelectedId(profile.id); setDraft(null); setCheck('idle') }}><span className="profile-option-icon">{profile.providerType === 'fake' ? 'F' : 'O'}</span><span><strong>{profile.name}</strong><small>{profile.model}</small></span></button>)}</section>
      <section className="profile-main">{!edit ? <EmptyState title="No agent profile" description="Create a FakeProvider profile to run the credential-free demo." action={<button className="button button-primary" onClick={startNew}>Create profile</button>} /> : <>
        <div className="profile-summary"><div><p className="eyebrow">{draft ? draft.id ? 'EDIT PROFILE' : 'NEW PROFILE' : `PROFILE / VERSION ${selected?.version}`}</p><h2>{draft ? draft.name || 'Untitled profile' : selected?.name}</h2><p>{edit.providerType === 'fake' ? 'Deterministic fixture provider. No network call or credential required.' : 'OpenAI-compatible HTTP endpoint. Connection is unavailable in this frontend preview.'}</p></div>{!draft && <div className="inline-actions"><button className="text-button" onClick={startEdit}>Edit profile</button><button className="text-button danger-text" onClick={() => setDeleteOpen(true)}>Delete</button></div>}</div>
        <form onSubmit={save} className="profile-form"><div className="panel"><div className="panel-heading"><span className="panel-index">01</span><div><h2>Provider</h2><p>Select a supported execution adapter.</p></div></div><div className="field-grid"><label>Profile name<input value={edit.name} disabled={!draft} onChange={event => set({ name: event.target.value })} required /></label><label>Provider type<select value={edit.providerType} disabled={!draft} onChange={event => { const providerType = event.target.value as ProviderType; set({ providerType, model: providerType === 'fake' ? 'fake-v1' : '', baseUrl: '' }) }}><option value="fake">FakeProvider</option><option value="openai_compatible">OpenAI-compatible HTTP</option></select></label></div>{edit.providerType === 'openai_compatible' && <label>Base URL<input type="url" value={edit.baseUrl} disabled={!draft} onChange={event => set({ baseUrl: event.target.value })} placeholder="https://provider.example/v1" /></label>}<label>Model<input value={edit.model} disabled={!draft} onChange={event => set({ model: event.target.value })} required /></label></div>
          <div className="panel"><div className="panel-heading"><span className="panel-index">02</span><div><h2>Instructions & generation</h2><p>These settings are included in the run snapshot.</p></div></div><label>System instructions<textarea value={edit.systemInstructions} disabled={!draft} onChange={event => set({ systemInstructions: event.target.value })} rows={4} /></label><div className="field-grid"><label>Temperature<input type="number" step="0.1" min="0" max="2" value={edit.temperature} disabled={!draft} onChange={event => set({ temperature: Number(event.target.value) })} /></label><label>Max tokens<input type="number" min="1" max="100000" value={edit.maxTokens} disabled={!draft} onChange={event => set({ maxTokens: Number(event.target.value) })} /></label></div></div>
          <div className="panel"><div className="panel-heading"><span className="panel-index">03</span><div><h2>Credential alias</h2><p>Aliases are configured on the backend. Secret values never enter this form.</p></div></div><label>Configured alias<select value={edit.credentialAlias} disabled={!draft || edit.providerType === 'fake'} onChange={event => set({ credentialAlias: event.target.value })}><option value="">None available in preview</option></select></label><div className="connection-row"><button type="button" className="button button-secondary" onClick={checkConnection} disabled={check === 'checking'}>{check === 'checking' ? 'Checking…' : 'Check connection'}</button>{check === 'success' && <span className="check-message success-text" role="status">FakeProvider ready for local demo.</span>}{check === 'unavailable' && <span className="check-message" role="status">Backend and configured credential alias required.</span>}</div></div>
          {error && <p className="field-error" role="alert">{error}</p>}{draft && <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => { setDraft(null); setError('') }}>Cancel</button><button type="submit" className="button button-primary">Save profile</button></div>}
        </form>
      </>}</section></div>
    {deleteOpen && selected && <Modal title="Delete profile?" description={`${selected.name} will be removed. ${workspace!.runs.filter(run => run.profileId === selected.id).length} historical run snapshots remain visible.`} onClose={() => setDeleteOpen(false)} footer={<><button className="button button-secondary" onClick={() => setDeleteOpen(false)}>Keep profile</button><button className="button button-danger" onClick={remove}>Delete profile</button></>} />}
  </>
}
