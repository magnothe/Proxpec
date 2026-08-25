import { useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { uuid, agora } from '../utils/format'
import { criarTemplatesPadrao } from '../data/defaults'

const CHAVE = 'prospecta:templates'

/**
 * Hook CRUD de templates de mensagem.
 */
export function useTemplates() {
  const [templates, setTemplates] = useLocalStorage(CHAVE, criarTemplatesPadrao)

  const adicionarTemplate = useCallback(
    (dados) => {
      const novo = {
        id: uuid(),
        nome: dados.nome?.trim() || 'Sem título',
        mensagem: dados.mensagem || '',
        criadoEm: agora(),
      }
      setTemplates((atual) => [...atual, novo])
      return novo
    },
    [setTemplates]
  )

  const atualizarTemplate = useCallback(
    (id, dados) => {
      setTemplates((atual) =>
        atual.map((t) => (t.id === id ? { ...t, ...dados } : t))
      )
    },
    [setTemplates]
  )

  const excluirTemplate = useCallback(
    (id) => {
      setTemplates((atual) => atual.filter((t) => t.id !== id))
    },
    [setTemplates]
  )

  return { templates, adicionarTemplate, atualizarTemplate, excluirTemplate }
}
