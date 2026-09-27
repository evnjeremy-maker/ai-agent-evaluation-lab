import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LabProvider } from './store'
import { App } from './App'
import './styles.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LabProvider><BrowserRouter><App /></BrowserRouter></LabProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
