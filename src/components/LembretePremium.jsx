import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, X } from 'lucide-react'
import { useStore } from '../context/StoreContext'

// De quanto em quanto tempo o lembrete reaparece depois de fechado.
const INTERVALO_MS = 8 * 60 * 1000 // 8 minutos
// Espera antes do primeiro lembrete, para não receber o usuário com um pop-up.
const ATRASO_INICIAL_MS = 90 * 1000 // 1min30
const CHAVE_ULTIMO = 'prospecta:ultimoLembretePremium'

// Telas onde o pop-up não aparece: no Login não faz sentido, e em Planos o
// usuário já está exatamente onde o pop-up mandaria ir.
const ROTAS_IGNORADAS = ['/planos']

export default function LembretePremium() {
  const { ehPremium, maxLeads, leads, carregado } = useStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [visivel, setVisivel] = useState(false)

  const usados = leads.length
  const ilimitado = maxLeads === Infinity
  const cheio = !ilimitado && usados >= maxLeads
  const restantes = ilimitado ? Infinity : Math.max(0, maxLeads - usados)

  useEffect(() => {
    if (ehPremium || !carregado || ROTAS_IGNORADAS.includes(pathname)) {
      setVisivel(false)
      return
    }

    const agendar = () => {
      let ultimo = 0
      try {
        ultimo = Number(localStorage.getItem(CHAVE_ULTIMO)) || 0
      } catch {
        ultimo = 0
      }
      const desdeUltimo = Date.now() - ultimo
      // Se nunca mostrou, usa o atraso inicial. Senão, completa o intervalo.
      const espera = ultimo === 0 ? ATRASO_INICIAL_MS : Math.max(0, INTERVALO_MS - desdeUltimo)
      return setTimeout(() => setVisivel(true), espera)
    }

    const timer = agendar()
    return () => clearTimeout(timer)
  }, [ehPremium, carregado, pathname, usados])

  const fechar = () => {
    setVisivel(false)
    try {
      localStorage.setItem(CHAVE_ULTIMO, String(Date.now()))
    } catch {
      // sem localStorage o lembrete volta no próximo ciclo; não é crítico
    }
  }

  const verPlanos = () => {
    fechar()
    navigate('/planos')
  }

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.22 }}
        >
          <div className="card border-whatsapp/30 p-4 shadow-glow">
            <button
              onClick={fechar}
              className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
              aria-label="Fechar"
            >
              <X size={15} />
            </button>

            <div className="flex items-start gap-3 pr-5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-whatsapp/15">
                <Crown size={17} className="text-whatsapp" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-slate-100">
                  {cheio ? 'Você atingiu o limite de leads' : 'Libere todo o Prospecta'}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {cheio
                    ? `Seu plano guarda ${maxLeads} leads. No Premium são ilimitados, com IA e disparo em massa.`
                    : restantes <= 10
                      ? `Faltam ${restantes} lead(s) para o seu limite. O Premium libera leads ilimitados.`
                      : 'Leads ilimitados, busca com IA e disparo em massa no WhatsApp.'}
                </p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary !py-1.5 text-xs" onClick={verPlanos}>
                    Ver planos
                  </button>
                  <button className="btn-ghost !py-1.5 text-xs" onClick={fechar}>
                    Agora não
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
