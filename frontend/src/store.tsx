import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { completeDemoRun, demoWorkspace, emptyWorkspace, type Workspace } from './model'

interface LabContextValue {
  workspace: Workspace | undefined
  loading: boolean
  error: boolean
  update: (change: (current: Workspace) => Workspace) => void
  reset: (empty: boolean) => void
}

const LabContext = createContext<LabContextValue | null>(null)
const queryKey = ['demo-workspace']

export function LabProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const query = useQuery<Workspace>({
    queryKey,
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 250))
      return structuredClone(demoWorkspace)
    },
    staleTime: Infinity,
    retry: false,
  })

  const update = (change: (current: Workspace) => Workspace) => {
    client.setQueryData<Workspace>(queryKey, current => current ? change(current) : current)
  }

  useEffect(() => {
    let timer = 0
    const advance = () => {
      client.setQueryData<Workspace>(queryKey, current => {
        if (!current) return current
        const active = current.runs.find(run => ['queued', 'running', 'evaluating'].includes(run.status))
        if (!active) return current
        const testCase = active.caseSnapshot
        if (!testCase) return current
        const next = active.status === 'queued' ? { ...active, status: 'running' as const } :
          active.status === 'running' ? { ...active, status: 'evaluating' as const } : completeDemoRun(active, testCase)
        return { ...current, runs: current.runs.map(run => run.id === active.id ? next : run) }
      })
      timer = window.setTimeout(advance, document.hidden ? 5000 : 1000)
    }
    const onVisibility = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(advance, document.hidden ? 5000 : 0)
    }
    timer = window.setTimeout(advance, 1000)
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [client])

  return <LabContext.Provider value={{ workspace: query.data, loading: query.isPending, error: query.isError, update, reset: empty => client.setQueryData(queryKey, empty ? emptyWorkspace() : structuredClone(demoWorkspace)) }}>
    {children}
  </LabContext.Provider>
}

export function useLab() {
  const value = useContext(LabContext)
  if (!value) throw new Error('LabProvider is required')
  return value
}
