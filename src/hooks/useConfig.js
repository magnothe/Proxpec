import { useStore } from '../context/StoreContext'

/**
 * Dados do negócio / configurações, servidos pelo StoreContext.
 */
export function useConfig() {
  const { config, atualizarConfig, adicionarSegmento, removerSegmento } = useStore()
  return { config, atualizarConfig, adicionarSegmento, removerSegmento }
}
