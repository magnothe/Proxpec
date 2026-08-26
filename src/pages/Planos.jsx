import { Crown, Check, X, Sparkles, Send, FileDown, Users, Infinity as InfinityIcon } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useStore } from '../context/StoreContext'
import { PLANOS } from '../utils/planos'

// Link de pagamento. Troque pela sua página de checkout quando ela existir.
const LINK_ASSINATURA = 'https://wa.me/5585999999999?text=Quero%20assinar%20o%20Prospecta%20Premium'

// Comparação lado a lado. `free`/`premium` são o que cada plano entrega.
const LINHAS = [
  { icone: Users, label: 'Leads salvos', free: `${PLANOS.free.maxLeads}`, premium: 'Ilimitados' },
  { icone: Sparkles, label: 'Busca e mensagens com IA', free: false, premium: true },
  { icone: Send, label: 'Disparo em massa no WhatsApp', free: false, premium: true },
  { icone: FileDown, label: 'Exportar leads em CSV', free: false, premium: true },
  { icone: Check, label: 'Busca de comércios no mapa', free: true, premium: true },
  { icone: Check, label: 'Templates de mensagem', free: true, premium: true },
]

function Celula({ valor, destaque }) {
  if (valor === true) {
    return <Check size={16} className={destaque ? 'text-whatsapp' : 'text-slate-400'} />
  }
  if (valor === false) return <X size={16} className="text-slate-700" />
  return (
    <span className={`text-sm font-medium ${destaque ? 'text-whatsapp' : 'text-slate-300'}`}>
      {valor}
    </span>
  )
}

export default function Planos() {
  const { plano, ehPremium, maxLeads, leads } = useStore()

  const usados = leads.length
  const ilimitado = maxLeads === Infinity
  const proporcao = ilimitado ? 0 : Math.min(100, (usados / maxLeads) * 100)
  const cheio = !ilimitado && usados >= maxLeads

  return (
    <div>
      <PageHeader
        titulo="Planos"
        subtitulo="Veja o que está liberado na sua conta e o que o Premium adiciona."
      />

      {/* Situação atual */}
      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crown size={18} className={ehPremium ? 'text-whatsapp' : 'text-slate-500'} />
            <span className="font-medium text-slate-100">Seu plano atual</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                ehPremium ? 'bg-whatsapp/15 text-whatsapp' : 'bg-surface-700 text-slate-400'
              }`}
            >
              {PLANOS[plano]?.nome || 'Grátis'}
            </span>
          </div>
          <span className="text-sm text-slate-400">
            {usados} {ilimitado ? 'leads salvos' : `de ${maxLeads} leads`}
          </span>
        </div>

        {!ilimitado && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-surface-800">
              <div
                className={`h-full rounded-full transition-all ${
                  cheio ? 'bg-red-400' : proporcao >= 80 ? 'bg-amber-400' : 'bg-whatsapp'
                }`}
                style={{ width: `${proporcao}%` }}
              />
            </div>
            {cheio && (
              <p className="mt-2 text-xs text-red-400">
                Você atingiu o limite. Apague algum lead ou passe para o Premium.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Comparação */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-surface-800 px-5 py-4">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Recurso</span>
          <span className="w-20 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
            Grátis
          </span>
          <span className="w-20 text-center text-xs font-medium uppercase tracking-wide text-whatsapp">
            Premium
          </span>
        </div>

        {LINHAS.map((linha) => {
          const Icone = linha.icone
          return (
            <div
              key={linha.label}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-surface-800/60 px-5 py-3.5 last:border-0"
            >
              <span className="flex items-center gap-2.5 text-sm text-slate-300">
                <Icone size={15} className="shrink-0 text-slate-500" />
                {linha.label}
              </span>
              <span className="flex w-20 justify-center">
                <Celula valor={linha.free} />
              </span>
              <span className="flex w-20 justify-center">
                <Celula valor={linha.premium} destaque />
              </span>
            </div>
          )
        })}
      </div>

      {ehPremium ? (
        <div className="card mt-6 flex items-center gap-3 p-5">
          <InfinityIcon size={18} className="shrink-0 text-whatsapp" />
          <p className="text-sm text-slate-300">
            Você já tem o Premium — todos os recursos liberados, sem limite de leads.
          </p>
        </div>
      ) : (
        <div className="card mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-slate-100">Quer liberar tudo?</p>
            <p className="mt-0.5 text-sm text-slate-400">
              Leads ilimitados, IA e disparo em massa.
            </p>
          </div>
          {/* TODO: trocar pelo link de pagamento (Stripe, Mercado Pago, etc.) */}
          <a
            href={LINK_ASSINATURA}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary shrink-0"
          >
            <Crown size={16} /> Quero o Premium
          </a>
        </div>
      )}
    </div>
  )
}
