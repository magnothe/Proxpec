// Definição dos planos.
//
// IMPORTANTE: isto é só a tabela de limites usada pela interface. Quem manda
// de verdade é a coluna `plano` da tabela `perfis` no Supabase, que o usuário
// NÃO tem permissão de escrever (ver docs/supabase-setup.sql). Nunca confie
// num plano vindo do estado local do app.

export const PLANOS = {
  free: {
    nome: 'Grátis',
    maxLeads: 50,
    recursos: {
      ia: false, // busca inteligente e mensagens geradas por IA
      disparoEmMassa: false, // envio em sequência na tela de Disparo
      exportarCsv: false,
    },
  },
  premium: {
    nome: 'Premium',
    maxLeads: Infinity,
    recursos: {
      ia: true,
      disparoEmMassa: true,
      exportarCsv: true,
    },
  },
}

/** Qualquer valor desconhecido cai em 'free' — nunca liberamos por engano. */
export function planoDe(plano) {
  return PLANOS[plano] || PLANOS.free
}

export function podeUsar(plano, recurso) {
  return Boolean(planoDe(plano).recursos[recurso])
}

export function limiteLeads(plano) {
  return planoDe(plano).maxLeads
}

/**
 * Quantos leads ainda cabem. Devolve 0 quando o limite já estourou
 * (pode acontecer se o cliente cair de premium para free).
 */
export function vagasRestantes(plano, quantidadeAtual) {
  const limite = limiteLeads(plano)
  if (limite === Infinity) return Infinity
  return Math.max(0, limite - quantidadeAtual)
}
