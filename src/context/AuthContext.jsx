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
        throw new Error(
          'E-mail ainda não confirmado. Clique no link que enviamos no cadastro (confira o spam).'
        )
      }
      throw new Error(error.message)
    }
  }

  /**
   * Cria uma conta nova. Devolve { precisaConfirmar } para a tela saber se
   * já entrou direto ou se o usuário precisa clicar no link do e-mail.
   */
  const cadastrar = async (email, senha) => {
    if (!supabaseConfigurado) throw new Error('Supabase não configurado.')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        // Sem isto o link de confirmação usa a "Site URL" do painel, que vem
        // como http://localhost:3000 de fábrica — e o cliente clica no e-mail
        // e cai numa página que não existe na máquina dele.
        // `window.location.origin` acerta sozinho em cada ambiente: localhost
        // no desenvolvimento, o domínio real em produção.
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) {
      // O serviço de e-mail embutido do Supabase manda pouquíssimos e-mails por
      // hora. Estourou o limite, o cadastro falha inteiro (o usuário NÃO é
      // criado), e a mensagem crua em inglês deixava a pessoa sem saber o que fazer.
      if (
        error.status === 429 ||
        /rate limit|over_email_send_rate_limit|security purposes/i.test(error.message)
      ) {
        throw new Error(
          'Muitos cadastros em pouco tempo e o envio do e-mail de confirmação foi bloqueado. Tente de novo daqui a alguns minutos.'
        )
      }
      if (/signups not allowed/i.test(error.message)) {
        throw new Error('Os cadastros estão desativados no momento.')
      }
      if (/already registered|already been registered/i.test(error.message)) {
        throw new Error('Esse e-mail já tem conta. Tente entrar.')
      }
      if (/password/i.test(error.message) && /least|short/i.test(error.message)) {
        throw new Error('A senha precisa ter pelo menos 6 caracteres.')
      }
      throw new Error(error.message)
    }
    // Com confirmação de e-mail ligada, o signUp devolve usuário mas sem sessão.
    return { precisaConfirmar: Boolean(data.user) && !data.session }
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
    cadastrar,
    sair,
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
