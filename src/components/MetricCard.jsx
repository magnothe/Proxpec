import { motion } from 'framer-motion'

export default function MetricCard({ icone: Icone, titulo, valor, sufixo, cor = '#25D366', detalhe }) {
  return (
    <motion.div
      className="card p-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-content-400">{titulo}</p>
          <p className="mt-2 font-display text-3xl font-bold text-content-100">
            {valor}
            {sufixo && <span className="ml-1 text-lg text-content-400">{sufixo}</span>}
          </p>
          {detalhe && <p className="mt-1 text-xs text-content-500">{detalhe}</p>}
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${cor}1f`, color: cor }}
        >
          {Icone && <Icone size={22} />}
        </div>
      </div>
    </motion.div>
  )
}
