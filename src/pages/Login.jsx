import { useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Send, Loader2, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)

  const submeter = async (e) => {
    e.preventDefault()
    if (!email.trim() || !senha) return toast.error('Preencha e-mail e senha.')
    setCarregando(true)
    try {
      await entrar(email, senha)
      toast.success('Bem-vindo de volta! 👋')
    } catch (err) {
      toast.error(err.message || 'Não foi possível entrar.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-whatsapp text-surface-950 shadow-glow">
            <Send size={26} />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Prospecta</h1>
          <p className="mt-1 text-sm text-slate-400">Entre para acessar seus leads</p>
        </div>

        <form onSubmit={submeter} className="card space-y-4 p-6">
          <div>
            <label className="label flex items-center gap-1.5">
              <Mail size={13} /> E-mail
            </label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Lock size={13} /> Senha
            </label>
            <input
              className="input"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={carregando}>
            {carregando ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-600">
          Acesso restrito. Apenas contas autorizadas conseguem entrar.
        </p>
      </motion.div>
    </div>
  )
}
