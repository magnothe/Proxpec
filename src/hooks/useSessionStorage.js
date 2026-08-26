import { useCallback, useState } from 'react'

/**
 * Igual ao useLocalStorage, mas guardando em sessionStorage.
 *
 * Serve para estado que precisa sobreviver à troca de página (o React Router
 * desmonta o componente e o useState se perde), sem virar dado permanente:
 * o sessionStorage vale só para aquela aba e some quando ela é fechada.
 * É o comportamento certo para resultados de busca, que envelhecem rápido.
 */
export function useSessionStorage(chave, valorInicial) {
  const inicial = useCallback(
    () => (typeof valorInicial === 'function' ? valorInicial() : valorInicial),
    [valorInicial]
  )

  const [valor, setValorState] = useState(() => {
    try {
      const item = window.sessionStorage.getItem(chave)
      if (item === null) return inicial()
      return JSON.parse(item)
    } catch (e) {
      console.warn(`Erro ao ler sessionStorage "${chave}":`, e)
      return inicial()
    }
  })

  const setValor = useCallback(
    (novo) => {
      setValorState((atual) => {
        const resolvido = typeof novo === 'function' ? novo(atual) : novo
        try {
          window.sessionStorage.setItem(chave, JSON.stringify(resolvido))
        } catch (e) {
          // Cota estourada (resultado muito grande) não pode quebrar a tela:
          // seguimos com o valor em memória, só sem persistir.
          console.warn(`Erro ao gravar sessionStorage "${chave}":`, e)
        }
        return resolvido
      })
    },
    [chave]
  )

  return [valor, setValor]
}
