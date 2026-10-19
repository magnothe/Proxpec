import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export const CHAVE_TEMA = 'prospecta:tema'

/**
 * Lê o tema já resolvido pelo script inline do index.html.
 *
 * Não repetimos a lógica de escolha aqui: o script roda antes da primeira
 * pintura e já decidiu (preferência salva, senão a do sistema). Perguntar ao
 * próprio <html> mantém as duas pontas em sincronia por construção — se um dia
 * a regra mudar, muda num lugar só.
 */
function temaAtual() {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(temaAtual)

  useEffect(() => {
    const raiz = document.documentElement
    raiz.classList.toggle('dark', tema === 'dark')

    // A barra de endereço do navegador no celular também acompanha.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', tema === 'dark' ? '#0a0f14' : '#f1f5f9')

    try {
      localStorage.setItem(CHAVE_TEMA, tema)
    } catch {
      // Modo anônimo ou storage bloqueado: o tema vale só para esta aba.
    }
  }, [tema])

  // Acompanha o sistema operacional — mas só enquanto o usuário não escolheu
  // nada. Depois de clicar no botão, a preferência dele manda.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const aoMudar = (e) => {
      let escolheu = false
      try {
        escolheu = Boolean(localStorage.getItem(CHAVE_TEMA))
      } catch {
        escolheu = false
      }
      if (!escolheu) setTema(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [])

  const alternarTema = useCallback(() => {
    setTema((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const valor = { tema, escuro: tema === 'dark', alternarTema, setTema }
  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme precisa estar dentro de ThemeProvider')
  return ctx
}
