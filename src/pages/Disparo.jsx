import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Send,
  MessageCircle,
  CheckSquare,
  Square,
  Rocket,
  Clock,
  StopCircle,
  Users,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import { useLeads, filtrarLeads } from '../hooks/useLeads'
import { useTemplates } from '../hooks/useTemplates'
import { useConfig } from '../hooks/useConfig'
import { STATUS_LISTA } from '../data/defaults'
import { gerarLinkWhatsApp, personalizarMensagem, formatarTelefone } from '../utils/whatsapp'

export default function Disparo() {
  const { leads, marcarContatado } = useLeads()
  const { templates } = useTemplates()
  const { config } = useConfig()

  const [status, setStatus] = useState('')
  const [segmento, setSegmento] = useState('')
  const [templateId, setTemplateId] = useState(templates[0]?.id || '')
  const [selecionados, setSelecionados] = useState(() => new Set())
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const cancelarRef = useRef(false)

  useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id)
  }, [templates, templateId])

  const segmentos = useMemo(
    () => [...new Set([...config.segmentos, ...leads.map((l) => l.segmento).filter(Boolean)])].sort(),
    [leads, config.segmentos]
  )

  const filtrados = useMemo(
    () => filtrarLeads(leads, { status, segmento }).filter((l) => l.telefone),
    [leads, status, segmento]
  )

  const template = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templates, templateId]
  )

  const listaSelecionada = useMemo(
    () => filtrados.filter((l) => selecionados.has(l.id)),
    [filtrados, selecionados]
  )

  const toggle = (id) => {
    setSelecionados((s) => {
      const novo = new Set(s)
      novo.has(id) ? novo.delete(id) : novo.add(id)
      return novo
    })
  }

  const todosSelecionados = filtrados.length > 0 && filtrados.every((l) => selecionados.has(l.id))

  const toggleTodos = () => {
    if (todosSelecionados) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(filtrados.map((l) => l.id)))
    }
  }

  const mensagemDe = (lead) =>
    template ? personalizarMensagem(template.mensagem, lead) : ''

  const abrirUm = (lead) => {
    const msg = mensagemDe(lead)
    window.open(gerarLinkWhatsApp(lead.telefone, msg), '_blank', 'noopener')
    marcarContatado(lead.id, template?.nome, msg)
  }

  const abrirTodos = async () => {
    if (!template) return toast.error('Escolha um template.')
    if (listaSelecionada.length === 0) return toast.error('Selecione ao menos um lead.')

    setEnviando(true)
    setProgresso(0)
    cancelarRef.current = false
    const intervalo = Math.max(0, Number(config.intervaloDisparo) || 0) * 1000

    toast.success(`Abrindo ${listaSelecionada.length} conversa(s)...`)

    for (let i = 0; i < listaSelecionada.length; i++) {
      if (cancelarRef.current) {
        toast('Disparo interrompido.', { icon: '✋' })
        break
      }
      const lead = listaSelecionada[i]
      const msg = mensagemDe(lead)
      const janela = window.open(gerarLinkWhatsApp(lead.telefone, msg), '_blank', 'noopener')
      if (!janela) {
        toast.error('O navegador bloqueou os pop-ups. Permita pop-ups para este site.')
        setEnviando(false)
        return
      }
      marcarContatado(lead.id, template?.nome, msg)
      setProgresso(i + 1)
      if (i < listaSelecionada.length - 1 && intervalo > 0) {
        await new Promise((r) => setTimeout(r, intervalo))
      }
    }

    setEnviando(false)
    if (!cancelarRef.current) {
      toast.success('Disparo concluído! Leads marcados como contatados.')
    }
  }

  const cancelar = () => {
    cancelarRef.current = true
  }

  if (leads.length === 0) {
    return (
      <div>
        <PageHeader titulo="Disparo em lote" />
        <EmptyState
          icone={Users}
          titulo="Nenhum lead para disparar"
          descricao="Cadastre leads antes de fazer um disparo."
          acao={
            <Link to="/leads" className="btn-primary">
              Ir para Leads
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        titulo="Disparo em lote"
        subtitulo="Selecione os leads, escolha um template e abra as conversas no WhatsApp."
      />

      {/* Configuração do disparo */}
      <div className="card mb-5 grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        <div>
          <label className="label">Filtrar por status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {STATUS_LISTA.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Filtrar por segmento</label>
          <select className="input" value={segmento} onChange={(e) => setSegmento(e.target.value)}>
            <option value="">Todos</option>
            {segmentos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Template da mensagem</label>
          <select
            className="input"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {templates.length === 0 && <option value="">Nenhum template</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Barra de ação */}
      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTodos}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-slate-100"
          >
            {todosSelecionados ? (
              <CheckSquare size={18} className="text-whatsapp" />
            ) : (
              <Square size={18} />
            )}
            Selecionar todos
          </button>
          <span className="text-sm text-slate-500">
            {listaSelecionada.length} de {filtrados.length} selecionado(s)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Clock size={13} /> Intervalo: {config.intervaloDisparo}s
          </span>
          {enviando ? (
            <button className="btn-danger" onClick={cancelar}>
              <StopCircle size={16} /> Parar ({progresso}/{listaSelecionada.length})
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={abrirTodos}
              disabled={listaSelecionada.length === 0 || !template}
            >
              <Rocket size={16} /> Abrir todos ({listaSelecionada.length})
            </button>
          )}
        </div>
      </div>

      {!template && templates.length === 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Você ainda não tem templates.{' '}
          <Link to="/templates" className="font-medium underline">
            Crie um template
          </Link>{' '}
          para usar no disparo.
        </div>
      )}

      {/* Lista de leads com preview */}
      {filtrados.length === 0 ? (
        <EmptyState
          icone={Send}
          titulo="Nenhum lead com esses filtros"
          descricao="Ajuste os filtros de status/segmento (leads sem telefone são ocultados)."
        />
      ) : (
        <div className="space-y-3">
          {filtrados.map((lead) => {
            const marcado = selecionados.has(lead.id)
            return (
              <div
                key={lead.id}
                className={`card p-4 transition-colors ${
                  marcado ? 'border-whatsapp/40 bg-whatsapp/5' : ''
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <button
                    onClick={() => toggle(lead.id)}
                    className="mt-0.5 shrink-0 text-slate-400 hover:text-whatsapp"
                    aria-label="Selecionar lead"
                  >
                    {marcado ? (
                      <CheckSquare size={20} className="text-whatsapp" />
                    ) : (
                      <Square size={20} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-100">{lead.nome}</span>
                      {lead.empresa && (
                        <span className="text-sm text-slate-500">· {lead.empresa}</span>
                      )}
                      <StatusBadge status={lead.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatarTelefone(lead.telefone)}
                      {lead.segmento ? ` · ${lead.segmento}` : ''}
                    </p>
                    {template && (
                      <div className="mt-2 rounded-lg bg-[#0b141a] p-2.5">
                        <div className="max-w-[90%] rounded-lg rounded-tl-sm bg-surface-700/70 px-3 py-2 text-[13px] leading-relaxed text-slate-200">
                          {mensagemDe(lead)}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    className="btn-primary shrink-0 self-start"
                    onClick={() => abrirUm(lead)}
                    disabled={!template}
                  >
                    <MessageCircle size={16} /> Abrir WhatsApp
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
