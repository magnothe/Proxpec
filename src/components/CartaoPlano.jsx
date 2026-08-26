import { Crown, Check, Lock } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { PLANOS } from '../utils/planos'

const RECURSOS = [
  { chave: 'ia', label: 'Busca e mensagens com IA' },
  { chave: 'disparoEmMassa', label: 'Disparo em massa no WhatsApp' },
  { chave: 'exportarCsv', label: 'Exportar leads em CSV' },
]

/**
 * Mostra o plano atual, o consumo de leads e o que está bloqueado.
 * Sem isto o usuário não tem como saber em que plano está — e o dono do
 * sistema não tem como conferir se a promoção a premium pegou.
 */
export default function CartaoPlano() {
  const { plano, ehPremium, pode, maxLeads, leads } = useStore()

  const usados = leads.length
  const ilimitado = maxLeads === Infinity
  const proporcao = ilimitado ? 0 : Math.min(100, (usados / maxLeads) * 100)
  const cheio = !ilimitado && usados >= maxLeads
  const quaseCheio = !ilimitado && !cheio && proporcao >= 80

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Crown size={18} className={ehPremium ? 'text-whatsapp' : 'text-slate-500'} />
          <span className="font-medium text-slate-100">Seu plano</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              ehPremium ? 'bg-whatsapp/15 text-whatsapp' : 'bg-surface-700 text-slate-400'
            }`}
          >
            {PLANOS[plano]?.nome || 'Grátis'}
          </span>
        </div>
        <span className="text-sm text-slate-400">
          {usados} {ilimitado ? 'leads' : `de ${maxLeads} leads`}
        </span>
      </div>

      {!ilimitado && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-800">
            <div
              className={`h-full rounded-full transition-all ${
                cheio ? 'bg-red-400' : quaseCheio ? 'bg-amber-400' : 'bg-whatsapp'
              }`}
              style={{ width: `${proporcao}%` }}
            />
          </div>
          {cheio && (
            <p className="mt-2 text-xs text-red-400">
              Limite atingido. Apague algum lead ou faça upgrade para adicionar mais.
            </p>
          )}
          {quaseCheio && (
            <p className="mt-2 text-xs text-amber-400">
              Faltam {maxLeads - usados} lead(s) para o limite.
            </p>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {RECURSOS.map((r) => {
          const liberado = pode(r.chave)
          return (
            <li
              key={r.chave}
              className={`flex items-center gap-2 text-sm ${
                liberado ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {liberado ? (
                <Check size={14} className="shrink-0 text-whatsapp" />
              ) : (
                <Lock size={14} className="shrink-0" />
              )}
              {r.label}
            </li>
          )
        })}
      </ul>

      {!ehPremium && (
        <p className="text-xs text-slate-500">
          O plano Premium libera leads ilimitados e os recursos acima.
        </p>
      )}
    </div>
  )
}
