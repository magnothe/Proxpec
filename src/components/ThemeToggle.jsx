import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

/**
 * Botão de tema. Mostra o ícone do tema que ESTÁ ATIVO (lua no escuro, sol no
 * claro) — o rótulo acessível é que diz para onde o clique leva.
 *
 * `variante="item"` imita um item do menu lateral (ícone + texto, largura
 * cheia); `variante="icone"` é só o botão redondo, para a tela de login.
 */
export default function ThemeToggle({ variante = 'icone', className = '' }) {
  const { escuro, alternarTema } = useTheme()
  const destino = escuro ? 'claro' : 'escuro'
  const Icone = escuro ? Moon : Sun

  const base =
    variante === 'item'
      ? 'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-content-400 transition-colors hover:bg-surface-800 hover:text-content-100'
      : 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-700 bg-surface-900 text-content-400 transition-colors hover:bg-surface-800 hover:text-content-100'

  return (
    <button
      type="button"
      onClick={alternarTema}
      className={`${base} ${className}`}
      title={`Mudar para o tema ${destino}`}
      aria-label={`Mudar para o tema ${destino}`}
    >
      {/* O ícone é trocado com uma rotação curta para a mudança não ser um
          corte seco. `mode="wait"` evita os dois ícones empilhados no meio. */}
      <span className="relative inline-flex h-[17px] w-[17px] items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={escuro ? 'lua' : 'sol'}
            initial={{ opacity: 0, rotate: -70, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 70, scale: 0.6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Icone size={17} />
          </motion.span>
        </AnimatePresence>
      </span>
      {variante === 'item' && <span>Tema {escuro ? 'escuro' : 'claro'}</span>}
    </button>
  )
}
