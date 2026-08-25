import { useCallback, useEffect, useState } from 'react'

/**
 * Hook de persistência reativa com localStorage.
 * Sincroniza entre abas e entre componentes via evento customizado.
 */
export function useLocalStorage(chave, valorInicial) {
  const ler = useCallback(() => {
    try {
      const item = window.localStorage.getItem(chave)
      if (item === null) return typeof valorInicial === 'function' ? valorInicial() : valorInicial
      return JSON.parse(item)
    } catch (e) {
      console.warn(`Erro ao ler localStorage "${chave}":`, e)
      return typeof valorInicial === 'function' ? valorInicial() : valorInicial
    }
  }, [chave])

  const [valor, setValorState] = useState(ler)

  const setValor = useCallback(
    (novo) => {
      setValorState((atual) => {
        const resolvido = typeof novo === 'function' ? novo(atual) : novo
        try {
          window.localStorage.setItem(chave, JSON.stringify(resolvido))
          // notifica outros hooks na mesma aba
          window.dispatchEvent(
            new CustomEvent('local-storage', { detail: { chave } })
          )
        } catch (e) {
          console.warn(`Erro ao gravar localStorage "${chave}":`, e)
        }
        return resolvido
      })
    },
    [chave]
  )

  useEffect(() => {
    const sincronizar = (e) => {
      if (e.key && e.key !== chave) return
      if (e.detail && e.detail.chave !== chave) return
      setValorState(ler())
    }
    window.addEventListener('storage', sincronizar)
    window.addEventListener('local-storage', sincronizar)
    return () => {
      window.removeEventListener('storage', sincronizar)
      window.removeEventListener('local-storage', sincronizar)
    }
  }, [chave, ler])

  return [valor, setValor]
}
