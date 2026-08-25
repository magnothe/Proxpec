import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [carregando, setCarregando] = useState(supabaseConfigurado)

  useEffect(() => {
    if (!supabaseConfigurado) {
      setCarregando(false)
      return
    }
    let ativo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return
      setSession(data.session)
      setCarregando(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSession(novaSessao)
    })

    return () => {
      ativo = false
      subscription?.unsubscribe()
    }
  }, [])

  const entrar = async (email, senha) => {
    if (!supabaseConfigurado) throw new Error('Supabase não configurado.')
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        throw new Error('E-mail ou senha incorretos.')
      }
      if (/email not confirmed/i.test(error.message)) {
        throw new Error('E-mail ainda não confirmado. Confirme o usuário no painel do Supabase.')
      }
      throw new Error(error.message)
    }
  }

  const sair = async () => {
    if (supabaseConfigurado) await supabase.auth.signOut()
    setSession(null)
  }

  const valor = {
    configurado: supabaseConfigurado,
    carregando,
    session,
    usuario: session?.user || null,
    entrar,
    sair,
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
