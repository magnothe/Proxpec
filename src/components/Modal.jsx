import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

export default function Modal({ aberto, aoFechar, titulo, children, largura = 'max-w-lg' }) {
  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && aoFechar?.()
    if (aberto) {
      document.addEventListener('keydown', onEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onEsc)
      document.body.style.overflow = ''
    }
  }, [aberto, aoFechar])

  return createPortal(
    <AnimatePresence>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={aoFechar}
          />
          <motion.div
            className={`card relative z-10 my-8 w-full ${largura} p-6 shadow-2xl`}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-100">{titulo}</h2>
              <button className="btn-icon" onClick={aoFechar} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
