import { useStore } from '../context/StoreContext'

/**
 * CRUD de templates, servido pelo StoreContext.
 */
export function useTemplates() {
  const { templates, adicionarTemplate, atualizarTemplate, excluirTemplate } = useStore()
  return { templates, adicionarTemplate, atualizarTemplate, excluirTemplate }
}
