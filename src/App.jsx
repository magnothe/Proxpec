import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Loader2, Send } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { StoreProvider, useStore } from './context/StoreContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Buscar from './pages/Buscar'
import Leads from './pages/Leads'
import Templates from './pages/Templates'
import Disparo from './pages/Disparo'
import Config from './pages/Config'

function Splash({ texto = 'Carregando...' }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 text-slate-400">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-whatsapp text-surface-950 shadow-glow">
        <Send size={26} />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Loader2 size={16} className="animate-spin" /> {texto}
      </div>
    </div>
  )
}

function AppRoutes() {
  const { carregado } = useStore()
  if (!carregado) return <Splash texto="Carregando seus dados..." />
  return (
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
  )
}

function Portao() {
  const { configurado, carregando, session } = useAuth()
  if (carregando) return <Splash texto="Iniciando..." />
  if (configurado && !session) return <Login />
  return (
    <StoreProvider>
      <AppRoutes />
    </StoreProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Portao />
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
    </AuthProvider>
  )
}
