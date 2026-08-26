import { useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Send, Loader2, Lock, Mail, UserPlus, MailCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { entrar, cadastrar } = useAuth()
  const [modo, setModo] = useState('entrar') // 'entrar' | 'cadastrar'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [confirmeSeuEmail, setConfirmeSeuEmail] = useState('')

  const cadastrando = modo === 'cadastrar'

  const submeter = async (e) => {
    e.preventDefault()
    if (!email.trim() || !senha) return toast.error('Preencha e-mail e senha.')
    if (cadastrando && senha.length < 6) {
      return toast.error('A senha precisa ter pelo menos 6 caracteres.')
    }

    setCarregando(true)
    try {
      if (cadastrando) {
        const { precisaConfirmar } = await cadastrar(email, senha)
        if (precisaConfirmar) {
          // Sem sessão: o Supabase mandou um link de confirmação.
          setConfirmeSeuEmail(email.trim())
        } else {
          toast.success('Conta criada! Bem-vindo 🎉')
        }
      } else {
        await entrar(email, senha)
        toast.success('Bem-vindo de volta! 👋')
      }
    } catch (err) {
      toast.error(err.message || 'Não foi possível continuar.')
    } finally {
      setCarregando(false)
    }
  }

  const trocarModo = () => {
    setModo(cadastrando ? 'entrar' : 'cadastrar')
    setSenha('')
  }

  // Tela de "confira seu e-mail", depois de um cadastro que exige confirmação.
  if (confirmeSeuEmail) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-10">
        <motion.div
          className="w-full max-w-sm text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-whatsapp text-surface-950 shadow-glow">
            <MailCheck size={26} />
          </div>
          <h1 className="font-display text-xl font-bold text-slate-100">Confirme seu e-mail</h1>
          <p className="mt-2 text-sm text-slate-400">
            Enviamos um link para <span className="text-slate-200">{confirmeSeuEmail}</span>. Clique
            nele para ativar a conta e depois volte aqui para entrar.
          </p>
          <p className="mt-3 text-xs text-slate-600">
            Não chegou? Confira a caixa de spam — o e-mail pode levar alguns minutos.
          </p>
          <button
            className="btn-ghost mt-5 w-full"
            onClick={() => {
              setConfirmeSeuEmail('')
              setModo('entrar')
            }}
          >
            Voltar para o login
          </button>
        </motion.div>
      </div>
    )
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
          <p className="mt-1 text-sm text-slate-400">
            {cadastrando ? 'Crie sua conta grátis e comece a prospectar' : 'Entre para acessar seus leads'}
          </p>
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
              autoComplete={cadastrando ? 'new-password' : 'current-password'}
            />
            {cadastrando && (
              <p className="mt-1.5 text-[11px] text-slate-600">Mínimo de 6 caracteres.</p>
            )}
          </div>
          <button type="submit" className="btn-primary w-full" disabled={carregando}>
            {carregando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : cadastrando ? (
              <UserPlus size={16} />
            ) : (
              <Lock size={16} />
            )}
            {carregando
              ? cadastrando
                ? 'Criando conta...'
                : 'Entrando...'
              : cadastrando
                ? 'Criar conta grátis'
                : 'Entrar'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          {cadastrando ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
          <button
            type="button"
            onClick={trocarModo}
            className="font-medium text-whatsapp hover:underline"
          >
            {cadastrando ? 'Entrar' : 'Cadastre-se grátis'}
          </button>
        </p>
      </motion.div>
    </div>
  )
}
