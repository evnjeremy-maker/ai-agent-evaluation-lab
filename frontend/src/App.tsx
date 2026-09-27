import { useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorState, LoadingState, Modal, NotFound } from './components'
import { useLab } from './store'
import { SuitesPage } from './pages/SuitesPage'
import { CasePage } from './pages/CasePage'
import { ProfilesPage } from './pages/ProfilesPage'
import { LaunchPage } from './pages/LaunchPage'
import { RunsPage } from './pages/RunsPage'
import { RunDetailPage } from './pages/RunDetailPage'
import { ComparePage } from './pages/ComparePage'

const navigation = [
  { to: '/suites', label: 'Suites', number: '01' },
  { to: '/profiles', label: 'Agent profiles', number: '02' },
  { to: '/launch', label: 'Launch run', number: '03' },
  { to: '/runs', label: 'Runs', number: '04' },
  { to: '/compare', label: 'Compare', number: '05' },
]

export function App() {
  const { workspace, loading, error, reset } = useLab()
  const [clearOpen, setClearOpen] = useState(false)
  const location = useLocation()
  const section = location.pathname.split('/')[1] || 'suites'

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">
      <div className="brand"><div><strong>Evaluation Lab</strong><small>Agent observability</small></div></div>
      <div className="sidebar-section-label">Workspace</div>
      <nav className="primary-nav" aria-label="Primary navigation">
        {navigation.map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><span className="nav-number">{item.number}</span><span>{item.label}</span></NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="environment-card"><span className="environment-dot" />Local demo <span className="environment-caption">Synthetic data only</span></div>
        <button className="sidebar-action" onClick={() => reset(false)}>Reload demo data</button>
        <button className="sidebar-action" onClick={() => setClearOpen(true)}>Clear workspace</button>
      </div>
    </aside>

    <div className="main-column">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>{section === 'cases' ? 'Case editor' : section === 'launch' ? 'Launch' : section === 'runs' && location.pathname.split('/')[2] ? 'Run detail' : section[0].toUpperCase() + section.slice(1)}</strong></div><div className="topbar-right"><span className="topbar-caption">LOCAL PREVIEW</span><span className="topbar-indicator" /></div></header>
      <main id="main-content" className="main-content">
        <div className="demo-note"><strong>Preview workspace</strong><span>This frontend uses synthetic, in-memory data. Runs simulate the FakeProvider flow. API persistence and server validation will connect when the backend exists.</span></div>
        {loading ? <LoadingState /> : error || !workspace ? <ErrorState onRetry={() => reset(false)} /> : <Routes>
          <Route path="/" element={<Navigate to="/suites" replace />} />
          <Route path="/suites" element={<SuitesPage />} />
          <Route path="/cases/new" element={<CasePage />} />
          <Route path="/cases/:caseId" element={<CasePage />} />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="/launch" element={<LaunchPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>}
      </main>
      <footer className="app-footer"><span>Evaluation Lab · local-first preview</span><Link to="/suites">Back to suites</Link></footer>
    </div>

    {clearOpen && <Modal title="Clear the preview workspace?" description="This removes all in-memory suites, cases, profiles, and runs. Reload demo data to restore the synthetic examples." onClose={() => setClearOpen(false)} footer={<><button className="button button-secondary" onClick={() => setClearOpen(false)}>Keep workspace</button><button className="button button-danger" onClick={() => { reset(true); setClearOpen(false) }}>Clear workspace</button></>} />}
  </div>
}
