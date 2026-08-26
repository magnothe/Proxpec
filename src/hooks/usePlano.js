import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { podeUsar, limiteLeads, vagasRestantes, planoDe } from '../utils/planos'

/**
 * Lê o plano do usuário da view `meu_plano` no Supabase.
 *
 * A view já resolve premium vencido para 'free', e a tabela por trás não tem
 * policy de escrita para o usuário — então este valor não é falsificável pelo
 * cliente. Enquanto carrega, e em qualquer erro, assumimos 'free': é melhor
 * bloquear um pagante por alguns segundos do que liberar premium de graça.
 */
export function usePlano() {
  const { session, configurado } = useAuth()
  const [plano, setPlano] = useState('free')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let cancelado = false

    // Sem Supabase configurado (modo local), tudo liberado: é uso próprio,
    // não há o que cobrar.
    if (!configurado) {
      setPlano('premium')
      setCarregando(false)
      return
    }

    if (!session?.user?.id) {
      setPlano('free')
      setCarregando(false)
      return
    }

    ;(async () => {
      try {
        const { data, error } = await supabase.from('meu_plano').select('plano').maybeSingle()
        if (error) throw error
        if (!cancelado) setPlano(data?.plano === 'premium' ? 'premium' : 'free')
      } catch (e) {
        console.warn('Não consegui ler o plano, assumindo grátis:', e)
        if (!cancelado) setPlano('free')
      } finally {
        if (!cancelado) setCarregando(false)
      }
    })()

    return () => {
      cancelado = true
    }
  }, [session?.user?.id, configurado])

  return {
    plano,
    carregando,
    ehPremium: plano === 'premium',
    detalhes: planoDe(plano),
    pode: (recurso) => podeUsar(plano, recurso),
    maxLeads: limiteLeads(plano),
    vagas: (qtdAtual) => vagasRestantes(plano, qtdAtual),
  }
}
