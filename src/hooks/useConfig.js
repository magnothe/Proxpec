import { useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { CONFIG_PADRAO } from '../data/defaults'

const CHAVE = 'prospecta:config'

/**
 * Hook para dados do negócio / configurações.
 */
export function useConfig() {
  const [config, setConfig] = useLocalStorage(CHAVE, CONFIG_PADRAO)

  const atualizarConfig = useCallback(
    (dados) => {
      setConfig((atual) => ({ ...atual, ...dados }))
    },
    [setConfig]
  )

  const adicionarSegmento = useCallback(
    (segmento) => {
      const s = segmento.trim()
      if (!s) return
      setConfig((atual) =>
        atual.segmentos.some((x) => x.toLowerCase() === s.toLowerCase())
          ? atual
          : { ...atual, segmentos: [...atual.segmentos, s] }
      )
    },
    [setConfig]
  )

  const removerSegmento = useCallback(
    (segmento) => {
      setConfig((atual) => ({
        ...atual,
        segmentos: atual.segmentos.filter((s) => s !== segmento),
      }))
    },
    [setConfig]
  )

  return { config, atualizarConfig, adicionarSegmento, removerSegmento }
}
