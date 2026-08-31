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
  Globe,
  GlobeLock,
  SkipForward,
  X,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import { useLeads, filtrarLeads } from '../hooks/useLeads'
import { useTemplates } from '../hooks/useTemplates'
import { useConfig } from '../hooks/useConfig'
import { STATUS_LISTA } from '../data/defaults'
import { situacaoSite } from '../utils/site'
import { gerarLinkWhatsApp, personalizarMensagem, formatarTelefone } from '../utils/whatsapp'

/**
 * Abre uma aba do WhatsApp e devolve a janela (ou null se o navegador barrou).
 *
 * ATENÇÃO: não passe 'noopener' aqui. O Chrome devolve `null` quando essa
 * flag é usada, mesmo tendo aberto a aba normalmente — era isso que fazia o
 * disparo em massa "não funcionar": a primeira aba abria, a segunda era lida
 * como bloqueada e o envio parava com o aviso de pop-up. Zeramos o `opener`
 * na mão logo depois, que dá a mesma proteção.
 */
function abrirWhatsApp(telefone, mensagem, alvo = '_blank') {
  let janela = null
  try {
    janela = window.open(gerarLinkWhatsApp(telefone, mensagem), alvo)
  } catch {
    janela = null
  }
  if (janela) {
    try {
      janela.opener = null
    } catch {
      /* o navegador não deixou mexer; a aba abriu, que é o que importa */
    }
  }
  return janela
}

export default function Disparo() {
  const { leads, marcarContatado, pode } = useLeads()
  const { templates } = useTemplates()
  const { config } = useConfig()

  const [status, setStatus] = useState('')
  const [segmento, setSegmento] = useState('')
  // Padrão: quem NÃO tem site — é para esses que a oferta faz sentido.
  const [filtroSite, setFiltroSite] = useState('sem')
  const [templateId, setTemplateId] = useState(templates[0]?.id || '')
  const [selecionados, setSelecionados] = useState(() => new Set())
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  // Modo fila: usado quando o navegador bloqueia pop-ups. Uma aba por clique,
  // que o navegador sempre permite por ser gesto direto do usuário.
  const [fila, setFila] = useState(null)
  const cancelarRef = useRef(false)

  useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id)
  }, [templates, templateId])

  const segmentos = useMemo(
    () => [...new Set([...config.segmentos, ...leads.map((l) => l.segmento).filter(Boolean)])].sort(),
    [leads, config.segmentos]
  )

  const filtrados = useMemo(() => {
    const base = filtrarLeads(leads, { status, segmento }).filter((l) => l.telefone)
    if (filtroSite === 'sem') return base.filter((l) => situacaoSite(l) !== true)
    if (filtroSite === 'com') return base.filter((l) => situacaoSite(l) === true)
    return base
  }, [leads, status, segmento, filtroSite])

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
    const janela = abrirWhatsApp(lead.telefone, msg)
    if (!janela) return toast.error('O navegador bloqueou a aba. Permita pop-ups para este site.')
    marcarContatado(lead.id, template?.nome, msg)
  }

  // Abre a conversa e já marca o lead como contatado. Devolve false quando o
  // navegador barrou a aba, para quem chamou decidir o que fazer.
  const disparar = (lead, alvo) => {
    const msg = mensagemDe(lead)
    const janela = abrirWhatsApp(lead.telefone, msg, alvo)
    if (!janela) return false
    marcarContatado(lead.id, template?.nome, msg)
    return true
  }

  const abrirTodos = async () => {
    if (!pode('disparoEmMassa')) {
      return toast.error('O disparo em massa é do plano Premium. No grátis, envie um a um.')
    }
    if (!template) return toast.error('Escolha um template.')
    if (listaSelecionada.length === 0) return toast.error('Selecione ao menos um lead.')

    const lista = listaSelecionada
    const intervalo = Math.max(0, Number(config.intervaloDisparo) || 0) * 1000
    cancelarRef.current = false

    // A primeira aba abre ainda dentro do clique — se nem essa passar, o
    // bloqueio de pop-ups é total e vamos direto para o modo fila.
    if (!disparar(lista[0])) {
      setFila({ lista, indice: 0 })
      return toast(
        'Pop-ups bloqueados. Liguei o modo fila: um clique por conversa, sem precisar liberar nada.',
        { icon: '📋', duration: 7000 }
      )
    }

    if (lista.length === 1) {
      return toast.success('Conversa aberta e lead marcado como contatado.')
    }

    setEnviando(true)
    setProgresso(1)
    toast.success(`Abrindo ${lista.length} conversas...`)

    for (let i = 1; i < lista.length; i++) {
      if (intervalo > 0) await new Promise((r) => setTimeout(r, intervalo))
      if (cancelarRef.current) {
        toast('Disparo interrompido.', { icon: '✋' })
        break
      }
      if (!disparar(lista[i])) {
        // Barrou no meio: em vez de perder o resto, passa o que faltou para a
        // fila manual.
        setEnviando(false)
        setFila({ lista, indice: i })
        return toast(
          `O navegador barrou a partir do ${i + 1}º. Continue pela fila abaixo (um clique por conversa).`,
          { icon: '📋', duration: 7000 }
        )
      }
      setProgresso(i + 1)
    }

    setEnviando(false)
    if (!cancelarRef.current) {
      toast.success('Disparo concluído! Leads marcados como contatados.')
    }
  }

  const cancelar = () => {
    cancelarRef.current = true
  }

  // ---- Modo fila ----
  const avancarFila = (enviar) => {
    if (!fila) return
    const lead = fila.lista[fila.indice]
    if (enviar && lead) {
      // Reaproveita sempre a mesma aba: não enche o navegador de abas.
      if (!disparar(lead, 'prospecta-whatsapp')) {
        return toast.error('Não consegui abrir a aba do WhatsApp. Verifique o bloqueador.')
      }
    }
    const proximo = fila.indice + 1
    if (proximo >= fila.lista.length) {
      setFila(null)
      toast.success('Fila concluída!')
      return
    }
    setFila({ ...fila, indice: proximo })
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

  const leadDaFila = fila ? fila.lista[fila.indice] : null

  return (
    <div className={fila ? 'pb-40' : ''}>
      <PageHeader
        titulo="Disparo em lote"
        subtitulo="Filtre o nicho, marque quem não tem site e abra todas as conversas de uma vez."
      />

      {/* Configuração do disparo */}
      <div className="card mb-5 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <label className="label">Nicho (segmento)</label>
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
          <label className="label">Situação do site</label>
          <select
            className="input"
            value={filtroSite}
            onChange={(e) => setFiltroSite(e.target.value)}
          >
            <option value="sem">Só quem não tem site</option>
            <option value="com">Só quem já tem site</option>
            <option value="">Todos</option>
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
            {filtroSite === 'sem' ? 'Selecionar todos sem site' : 'Selecionar todos'}
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
              disabled={listaSelecionada.length === 0 || !template || Boolean(fila)}
            >
              <Rocket size={16} /> Enviar para {listaSelecionada.length} selecionado(s)
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
          descricao="Ajuste status, nicho ou a situação do site (leads sem telefone são ocultados)."
        />
      ) : (
        <div className="space-y-3">
          {filtrados.map((lead) => {
            const marcado = selecionados.has(lead.id)
            const site = situacaoSite(lead)
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
                      {site === true ? (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Globe size={11} /> tem site
                        </span>
                      ) : site === false ? (
                        <span className="flex items-center gap-1 text-[11px] text-amber-400">
                          <GlobeLock size={11} /> sem site
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-slate-600">
                          <GlobeLock size={11} /> site não informado
                        </span>
                      )}
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

      {/* Fila manual: aparece quando o navegador barra os pop-ups */}
      {leadDaFila && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-700 bg-surface-800/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Fila · {fila.indice + 1} de {fila.lista.length}
              </p>
              <p className="truncate font-medium text-slate-100">
                {leadDaFila.nome}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {formatarTelefone(leadDaFila.telefone)}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button className="btn-primary" onClick={() => avancarFila(true)}>
                <MessageCircle size={16} /> Abrir e avançar
              </button>
              <button className="btn-ghost" onClick={() => avancarFila(false)}>
                <SkipForward size={16} /> Pular
              </button>
              <button
                className="btn-ghost"
                onClick={() => setFila(null)}
                aria-label="Encerrar fila"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
