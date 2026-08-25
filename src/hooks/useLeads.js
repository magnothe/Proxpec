import { useCallback, useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { uuid, agora } from '../utils/format'
import { apenasDigitos } from '../utils/whatsapp'
import { criarLeadsExemplo } from '../data/defaults'

const CHAVE = 'prospecta:leads'

/**
 * Hook com todas as operações CRUD de leads + filtros.
 */
export function useLeads() {
  const [leads, setLeads] = useLocalStorage(CHAVE, criarLeadsExemplo)

  const adicionarLead = useCallback(
    (dados) => {
      const t = agora()
      const novo = {
        id: uuid(),
        nome: dados.nome?.trim() || '',
        empresa: dados.empresa?.trim() || '',
        telefone: apenasDigitos(dados.telefone),
        segmento: dados.segmento?.trim() || '',
        status: dados.status || 'novo',
        notas: dados.notas?.trim() || '',
        criadoEm: t,
        atualizadoEm: t,
        historico: [{ data: t, acao: 'Lead cadastrado' }],
      }
      setLeads((atual) => [novo, ...atual])
      return novo
    },
    [setLeads]
  )

  const atualizarLead = useCallback(
    (id, dados) => {
      setLeads((atual) =>
        atual.map((l) =>
          l.id === id
            ? {
                ...l,
                ...dados,
                telefone: dados.telefone !== undefined ? apenasDigitos(dados.telefone) : l.telefone,
                atualizadoEm: agora(),
              }
            : l
        )
      )
    },
    [setLeads]
  )

  const excluirLead = useCallback(
    (id) => {
      setLeads((atual) => atual.filter((l) => l.id !== id))
    },
    [setLeads]
  )

  const mudarStatus = useCallback(
    (id, status) => {
      setLeads((atual) =>
        atual.map((l) =>
          l.id === id
            ? {
                ...l,
                status,
                atualizadoEm: agora(),
                historico: [
                  ...(l.historico || []),
                  { data: agora(), acao: `Status alterado para "${status}"` },
                ],
              }
            : l
        )
      )
    },
    [setLeads]
  )

  const registrarHistorico = useCallback(
    (id, entrada) => {
      setLeads((atual) =>
        atual.map((l) =>
          l.id === id
            ? {
                ...l,
                atualizadoEm: agora(),
                historico: [...(l.historico || []), { data: agora(), ...entrada }],
              }
            : l
        )
      )
    },
    [setLeads]
  )

  /**
   * Marca lead como contatado (usado no disparo) registrando template usado.
   */
  const marcarContatado = useCallback(
    (id, template, mensagem) => {
      setLeads((atual) =>
        atual.map((l) => {
          if (l.id !== id) return l
          const avancaStatus = l.status === 'novo' ? 'contatado' : l.status
          return {
            ...l,
            status: avancaStatus,
            atualizadoEm: agora(),
            historico: [
              ...(l.historico || []),
              {
                data: agora(),
                acao: 'Mensagem enviada via WhatsApp',
                template: template || undefined,
                mensagem: mensagem || undefined,
              },
            ],
          }
        })
      )
    },
    [setLeads]
  )

  const importarLeads = useCallback(
    (lista) => {
      const t = agora()
      const novos = lista.map((dados) => ({
        id: uuid(),
        nome: (dados.nome || '').trim(),
        empresa: (dados.empresa || '').trim(),
        telefone: apenasDigitos(dados.telefone),
        segmento: (dados.segmento || '').trim(),
        status: dados.status || 'novo',
        notas: (dados.notas || '').trim(),
        criadoEm: t,
        atualizadoEm: t,
        historico: [{ data: t, acao: 'Importado via CSV' }],
      }))
      setLeads((atual) => [...novos, ...atual])
      return novos.length
    },
    [setLeads]
  )

  return {
    leads,
    adicionarLead,
    atualizarLead,
    excluirLead,
    mudarStatus,
    marcarContatado,
    registrarHistorico,
    importarLeads,
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
