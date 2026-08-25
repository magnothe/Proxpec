import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { Users, UserPlus, MessageCircle, TrendingUp, ArrowRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import MetricCard from '../components/MetricCard'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import { useLeads } from '../hooks/useLeads'
import { useTemplates } from '../hooks/useTemplates'
import { useConfig } from '../hooks/useConfig'
import { STATUS, STATUS_LISTA } from '../data/defaults'
import { ehHoje, tempoRelativo } from '../utils/format'
import { gerarLinkWhatsApp, personalizarMensagem } from '../utils/whatsapp'

function contarMensagens(leads) {
  return leads.reduce(
    (total, l) =>
      total +
      (l.historico || []).filter((h) => h.acao === 'Mensagem enviada via WhatsApp').length,
    0
  )
}

function dadosSemana(leads) {
  const dias = []
  const hoje = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje)
    d.setDate(hoje.getDate() - i)
    d.setHours(0, 0, 0, 0)
    dias.push(d)
  }
  return dias.map((dia) => {
    const proximo = new Date(dia)
    proximo.setDate(dia.getDate() + 1)
    const doDia = leads.filter((l) => {
      const c = new Date(l.criadoEm)
      return c >= dia && c < proximo
    })
    const registro = {
      dia: dia.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    }
    STATUS_LISTA.forEach((s) => {
      registro[s.valor] = doDia.filter((l) => l.status === s.valor).length
    })
    return registro
  })
}

export default function Dashboard() {
  const { leads, marcarContatado } = useLeads()
  const { templates } = useTemplates()
  const { config } = useConfig()
  const navigate = useNavigate()

  const metricas = useMemo(() => {
    const total = leads.length
    const novosHoje = leads.filter((l) => ehHoje(l.criadoEm)).length
    const mensagens = contarMensagens(leads)
    const fechados = leads.filter((l) => l.status === 'fechado').length
    const conversao = total ? Math.round((fechados / total) * 100) : 0
    return { total, novosHoje, mensagens, conversao, fechados }
  }, [leads])

  const semana = useMemo(() => dadosSemana(leads), [leads])
  const temDadosSemana = useMemo(
    () => semana.some((d) => STATUS_LISTA.some((s) => d[s.valor] > 0)),
    [semana]
  )

  const recentes = useMemo(
    () =>
      [...leads]
        .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
        .slice(0, 5),
    [leads]
  )

  const enviarRapido = (lead) => {
    const template = templates[0]
    const msg = template
      ? personalizarMensagem(template.mensagem, lead)
      : `Olá, ${lead.nome}!`
    window.open(gerarLinkWhatsApp(lead.telefone, msg), '_blank', 'noopener')
    marcarContatado(lead.id, template?.nome, msg)
  }

  return (
    <div>
      <PageHeader
        titulo={`Olá! 👋`}
        subtitulo={`Visão geral da prospecção de ${config.nomeEmpresa || 'seu negócio'}.`}
        acoes={
          <Link to="/disparo" className="btn-primary">
            <MessageCircle size={16} /> Disparar mensagens
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icone={Users} titulo="Total de leads" valor={metricas.total} cor="#38bdf8" />
        <MetricCard
          icone={UserPlus}
          titulo="Novos hoje"
          valor={metricas.novosHoje}
          cor="#a78bfa"
        />
        <MetricCard
          icone={MessageCircle}
          titulo="Mensagens enviadas"
          valor={metricas.mensagens}
          cor="#25D366"
        />
        <MetricCard
          icone={TrendingUp}
          titulo="Taxa de conversão"
          valor={metricas.conversao}
          sufixo="%"
          cor="#fbbf24"
          detalhe={`${metricas.fechados} fechado(s)`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Gráfico */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-100">Leads na semana</h2>
              <p className="text-xs text-slate-500">Cadastrados nos últimos 7 dias, por status</p>
            </div>
          </div>
          {temDadosSemana ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={semana} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2833" vertical={false} />
                <XAxis dataKey="dia" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: '#0f151c',
                    border: '1px solid #2a3744',
                    borderRadius: 10,
                    fontSize: 13,
                  }}
                  labelStyle={{ color: '#e2e8f0' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(v) => STATUS[v]?.label || v}
                />
                {STATUS_LISTA.map((s) => (
                  <Bar
                    key={s.valor}
                    dataKey={s.valor}
                    stackId="a"
                    fill={s.cor}
                    radius={s.valor === 'perdido' ? [4, 4, 0, 0] : 0}
                    maxBarSize={44}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
              Nenhum lead cadastrado nos últimos 7 dias.
            </div>
          )}
        </div>

        {/* Distribuição por status */}
        <div className="card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-slate-100">Por status</h2>
          <div className="space-y-3">
            {STATUS_LISTA.map((s) => {
              const qtd = leads.filter((l) => l.status === s.valor).length
              const pct = leads.length ? Math.round((qtd / leads.length) * 100) : 0
              return (
                <div key={s.valor}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.cor }} />
                      {s.label}
                    </span>
                    <span className="text-slate-400">{qtd}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-800">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: s.cor }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Leads recentes */}
      <div className="mt-6 card overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-slate-100">Leads recentes</h2>
          <Link to="/leads" className="flex items-center gap-1 text-sm text-whatsapp hover:underline">
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>
        {recentes.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icone={Users}
              titulo="Nenhum lead ainda"
              descricao="Cadastre seu primeiro lead para começar a prospectar."
              acao={
                <button className="btn-primary" onClick={() => navigate('/leads')}>
                  Ir para Leads
                </button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {recentes.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-surface-800/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-700 text-sm font-semibold text-slate-300">
                  {lead.nome.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-100">{lead.nome}</p>
                  <p className="truncate text-xs text-slate-500">
                    {lead.empresa || 'Sem empresa'} · {tempoRelativo(lead.criadoEm)}
                  </p>
                </div>
                <StatusBadge status={lead.status} />
                <button
                  className="btn-primary !px-3 !py-1.5 text-xs"
                  onClick={() => enviarRapido(lead)}
                  title="Enviar WhatsApp com o template de primeiro contato"
                >
                  <MessageCircle size={14} /> WhatsApp
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
