import { useStore } from '../context/StoreContext'

/**
 * Operações de leads (CRUD + filtros), agora servidas pelo StoreContext
 * (nuvem via Supabase, ou local no modo de segurança).
 */
export function useLeads() {
  const {
    leads,
    adicionarLead,
    atualizarLead,
    excluirLead,
    mudarStatus,
    marcarContatado,
    registrarHistorico,
    importarLeads,
    jaAbordados,
  } = useStore()

  return {
    leads,
    adicionarLead,
    atualizarLead,
    excluirLead,
    mudarStatus,
    marcarContatado,
    registrarHistorico,
    importarLeads,
    jaAbordados,
  }
}

/**
 * Aplica filtros a uma lista de leads (busca, status, segmento).
 */
export function filtrarLeads(leads, { busca = '', status = '', segmento = '' } = {}) {
  const b = busca.trim().toLowerCase()
  return leads.filter((l) => {
    if (status && l.status !== status) return false
    if (segmento && l.segmento !== segmento) return false
    if (b) {
      const alvo = `${l.nome} ${l.empresa}`.toLowerCase()
      if (!alvo.includes(b)) return false
    }
    return true
  })
}
