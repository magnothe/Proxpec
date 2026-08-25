import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Buscar from './pages/Buscar'
import Leads from './pages/Leads'
import Templates from './pages/Templates'
import Disparo from './pages/Disparo'
import Config from './pages/Config'

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/buscar" element={<Buscar />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/disparo" element={<Disparo />} />
          <Route path="/config" element={<Config />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#161e27',
            color: '#e2e8f0',
            border: '1px solid #2a3744',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#25D366', secondary: '#0a0f14' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#0a0f14' } },
        }}
      />
    </>
  )
}
