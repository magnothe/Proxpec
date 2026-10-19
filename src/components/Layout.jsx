import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Send } from 'lucide-react'
import Sidebar from './Sidebar'
import ThemeToggle from './ThemeToggle'

export default function Layout() {
  const location = useLocation()
  return (
    <div className="min-h-full">
      <Sidebar />

      {/*
        Barra de topo só no celular. No desktop o botão de tema já vive no menu
        lateral; aqui ele não caberia na navegação de baixo, que já leva os seis
        itens do app e ficaria apertada com um sétimo.
      */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-surface-700 bg-surface-900/90 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-whatsapp text-onAccent">
            <Send size={14} />
          </div>
          <span className="font-display text-sm font-bold text-content-100">Prospecta</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="pb-20 md:pb-0 md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
