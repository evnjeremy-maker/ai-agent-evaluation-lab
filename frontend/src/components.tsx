import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { RunStatus, Verdict } from './model'

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return <header className="page-heading">
    <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>
}

export function Badge({ value }: { value: RunStatus | Verdict | 'pending' | 'imported' | 'executed' }) {
  return <span className={`badge badge-${value.replace('_', '-')}`}>{value.replaceAll('_', ' ')}</span>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-glyph" aria-hidden="true">∅</span><h2>{title}</h2><p>{description}</p>{action}</div>
}

export function LoadingState() {
  return <div className="loading-state" role="status"><span className="spinner" aria-hidden="true" />Loading workspace…</div>
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return <div className="empty-state" role="alert"><h2>Could not load this view</h2><p>Refresh the local preview and try again.</p>{onRetry && <button className="button button-secondary" onClick={onRetry}>Retry</button>}</div>
}

export function Modal({ title, description, children, onClose, footer }: { title: string; description?: string; children?: ReactNode; onClose: () => void; footer?: ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null)
  const closeHandler = useRef(onClose)
  closeHandler.current = onClose
  useEffect(() => {
    const initial = dialog.current?.querySelector<HTMLElement>('[autofocus]')
    if (initial) initial.focus()
    else close.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeHandler.current()
      if (event.key === 'Tab' && dialog.current) {
        const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')).filter(element => !element.hasAttribute('disabled'))
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previousFocus.current?.focus() }
  }, [])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby={description ? 'dialog-description' : undefined} ref={dialog}>
      <div className="modal-top"><h2 id="dialog-title">{title}</h2><button ref={close} className="icon-button" aria-label="Close dialog" onClick={onClose}>×</button></div>
      {description && <p id="dialog-description" className="muted">{description}</p>}
      {children}
      {footer && <div className="modal-footer">{footer}</div>}
    </div>
  </div>
}

export function JsonDisclosure({ value, label = 'Payload' }: { value: unknown; label?: string }) {
  const json = JSON.stringify(value, null, 2)
  const [message, setMessage] = useState('')
  const copy = async () => { try { await navigator.clipboard.writeText(json); setMessage('JSON copied.') } catch { setMessage('Clipboard unavailable.') } }
  return <details className="json-disclosure"><summary>{label}</summary><div className="json-toolbar"><button type="button" className="text-button" onClick={copy}>Copy JSON</button></div>{message && <span className="copy-status" role="status">{message}</span>}<pre>{json}</pre></details>
}

export function NotFound() {
  return <EmptyState title="Page not found" description="This view does not exist in the local preview." action={<Link className="button button-primary" to="/suites">Open suites</Link>} />
}

export const formatDate = (date: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
