import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Search,
  Sparkles,
  MapPin,
  Globe,
  GlobeLock,
  Phone,
  PhoneOff,
  Plus,
  MessageCircle,
  CheckSquare,
  Square,
  Loader2,
  Wand2,
  ExternalLink,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { buscarComercios, TIPOS_COMERCIO } from '../utils/overpass'
import { interpretarBusca, iaDisponivel, gerarMensagemIA } from '../utils/aiAgent'
import { useLeads } from '../hooks/useLeads'
import { useConfig } from '../hooks/useConfig'
import { gerarLinkWhatsApp, formatarTelefone } from '../utils/whatsapp'

export default function Buscar() {
  const { leads, importarLeads, marcarContatado } = useLeads()
  const { config } = useConfig()
  const temIA = iaDisponivel(config)

  const [tipo, setTipo] = useState('restaurante')
  const [cidade, setCidade] = useState('')
  const [somenteSemSite, setSomenteSemSite] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [interpretando, setInterpretando] = useState(false)
  const [textoIA, setTextoIA] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscou, setBuscou] = useState(false)
  const [selecionados, setSelecionados] = useState(() => new Set())
  const [infoCidade, setInfoCidade] = useState(null)
  const [gerandoMsg, setGerandoMsg] = useState(null)

  // telefones já cadastrados, para marcar duplicados
  const telefonesExistentes = useMemo(
    () => new Set(leads.map((l) => l.telefone).filter(Boolean)),
    [leads]
  )
  const nomesExistentes = useMemo(
    () => new Set(leads.map((l) => `${l.nome}`.toLowerCase())),
    [leads]
  )

  const jaCadastrado = (r) =>
    (r.telefone && telefonesExistentes.has(r.telefone)) || nomesExistentes.has(r.nome.toLowerCase())

  const visiveis = useMemo(
    () => (somenteSemSite ? resultados.filter((r) => !r.temSite) : resultados),
    [resultados, somenteSemSite]
  )

  const executarBusca = async (tipoBusca = tipo, cidadeBusca = cidade) => {
    if (!cidadeBusca.trim()) {
      toast.error('Informe a cidade.')
      return
    }
    setBuscando(true)
    setBuscou(true)
    setSelecionados(new Set())
    try {
      const { cidade: local, resultados: res } = await buscarComercios({
        tipo: tipoBusca,
        cidade: cidadeBusca,
      })
      setResultados(res)
      setInfoCidade(local)
      if (res.length === 0) {
        toast('Nenhum comércio encontrado nessa cidade para esse tipo.', { icon: '🔍' })
      } else {
        const semSite = res.filter((r) => !r.temSite).length
        toast.success(`${res.length} encontrados · ${semSite} sem site (oportunidades!)`)
      }
    } catch (e) {
      console.error(e)
      toast.error(e.message || 'Erro na busca.')
      setResultados([])
    } finally {
      setBuscando(false)
    }
  }

  const buscarComIA = async () => {
    if (!textoIA.trim()) {
      toast.error('Descreva o que você procura.')
      return
    }
    setInterpretando(true)
    try {
      const r = await interpretarBusca(textoIA, config)
      if (r._erroIA) toast(`IA indisponível, usei interpretação simples. (${r._erroIA})`, { icon: '⚠️' })
      const novoTipo = r.tipo || tipo
      const novaCidade = r.cidade || cidade
      setTipo(novoTipo)
      setCidade(novaCidade)
      setSomenteSemSite(Boolean(r.semSite))
      if (!novaCidade.trim()) {
        toast('Entendi o tipo, mas não a cidade. Preencha a cidade e busque.', { icon: '📍' })
        setInterpretando(false)
        return
      }
      setInterpretando(false)
      await executarBusca(novoTipo, novaCidade)
    } catch (e) {
      toast.error(e.message || 'Não consegui interpretar a busca.')
      setInterpretando(false)
    }
  }

  const toggle = (id) => {
    setSelecionados((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const selecionaveis = visiveis.filter((r) => !jaCadastrado(r))
  const todosSelec = selecionaveis.length > 0 && selecionaveis.every((r) => selecionados.has(r.osmId))
  const toggleTodos = () => {
    if (todosSelec) setSelecionados(new Set())
    else setSelecionados(new Set(selecionaveis.map((r) => r.osmId)))
  }

  const adicionarSelecionados = () => {
    const escolhidos = visiveis.filter((r) => selecionados.has(r.osmId) && !jaCadastrado(r))
    if (escolhidos.length === 0) {
      toast.error('Selecione ao menos um comércio novo.')
      return
    }
    const qtd = importarLeads(
      escolhidos.map((r) => ({
        nome: r.nome,
        empresa: r.nome,
        telefone: r.telefone,
        segmento: r.tipoLabel,
        notas: [r.endereco, r.site ? `Site: ${r.site}` : 'Sem site', `Fonte: OpenStreetMap (${r.cidade})`]
          .filter(Boolean)
          .join('\n'),
      }))
    )
    toast.success(`${qtd} comércio(s) adicionado(s) aos seus leads!`)
    setSelecionados(new Set())
  }

  const adicionarUm = (r) => {
    importarLeads([
      {
        nome: r.nome,
        empresa: r.nome,
        telefone: r.telefone,
        segmento: r.tipoLabel,
        notas: [r.endereco, r.site ? `Site: ${r.site}` : 'Sem site', `Fonte: OpenStreetMap (${r.cidade})`]
          .filter(Boolean)
          .join('\n'),
      },
    ])
    toast.success(`${r.nome} adicionado aos leads!`)
  }

  const whatsappIA = async (r) => {
    if (!r.telefone) return toast.error('Este comércio não tem telefone no cadastro.')
    let mensagem = `Olá! Tudo bem? Passando para falar sobre um site profissional para a ${r.nome}. Posso te mostrar alguns exemplos? 🚀`
    if (temIA) {
      setGerandoMsg(r.osmId)
      try {
        mensagem = await gerarMensagemIA(r, config)
      } catch (e) {
        toast(`IA falhou, usei mensagem padrão. (${e.message})`, { icon: '⚠️' })
      } finally {
        setGerandoMsg(null)
      }
    }
    window.open(gerarLinkWhatsApp(r.telefone, mensagem), '_blank', 'noopener')
    toast.success(`WhatsApp aberto para ${r.nome}`)
  }

  return (
    <div>
      <PageHeader
        titulo="Buscar clientes"
        subtitulo="Encontre comércios reais por tipo e cidade (dados do OpenStreetMap) e adicione aos seus leads."
      />

      {/* Busca com IA / linguagem natural */}
      <div className="card mb-4 p-4">
        <label className="label flex items-center gap-1.5">
          <Sparkles size={14} className="text-whatsapp" /> Busca inteligente
          {temIA ? (
            <span className="ml-1 rounded-full bg-whatsapp/15 px-2 py-0.5 text-[10px] font-medium text-whatsapp">
              IA ativa
            </span>
          ) : (
            <span className="ml-1 rounded-full bg-surface-700 px-2 py-0.5 text-[10px] text-slate-400">
              modo simples
            </span>
          )}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            placeholder='Ex: "restaurantes em Campinas sem site"'
            value={textoIA}
            onChange={(e) => setTextoIA(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !interpretando && !buscando && buscarComIA()}
          />
          <button className="btn-primary shrink-0" onClick={buscarComIA} disabled={interpretando || buscando}>
            {interpretando ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {interpretando ? 'Interpretando...' : 'Buscar com IA'}
          </button>
        </div>
        {!temIA && (
          <p className="mt-2 text-xs text-slate-500">
            Dica: ative a IA em{' '}
            <Link to="/config" className="text-whatsapp hover:underline">
              Configurações
            </Link>{' '}
            para interpretação mais precisa e mensagens geradas sob medida. Sem IA, a busca por
            tipo + cidade abaixo funciona normalmente.
          </p>
        )}
      </div>

      {/* Busca manual estruturada */}
      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label">Tipo de comércio</label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_COMERCIO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            <MapPin size={13} /> Cidade
          </label>
          <input
            className="input"
            placeholder="Ex: Campinas"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !buscando && executarBusca()}
          />
        </div>
        <button className="btn-primary" onClick={() => executarBusca()} disabled={buscando}>
          {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Barra de resultados */}
      {resultados.length > 0 && (
        <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleTodos}
              className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-slate-100"
            >
              {todosSelec ? (
                <CheckSquare size={18} className="text-whatsapp" />
              ) : (
                <Square size={18} />
              )}
              Selecionar novos
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={somenteSemSite}
                onChange={(e) => setSomenteSemSite(e.target.checked)}
                className="h-4 w-4 accent-[#25D366]"
              />
              Só quem não tem site
            </label>
            <span className="text-sm text-slate-500">
              {visiveis.length} exibido(s) · {selecionados.size} selecionado(s)
            </span>
          </div>
          <button className="btn-primary" onClick={adicionarSelecionados} disabled={selecionados.size === 0}>
            <Plus size={16} /> Adicionar aos leads ({selecionados.size})
          </button>
        </div>
      )}

      {/* Lista */}
      {!buscou ? (
        <EmptyState
          icone={Search}
          titulo="Faça sua primeira busca"
          descricao="Escolha um tipo de comércio e uma cidade, ou descreva o que procura na busca inteligente."
        />
      ) : buscando ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-slate-400">
          <Loader2 size={28} className="animate-spin text-whatsapp" />
          <p className="text-sm">Buscando comércios reais em {cidade}...</p>
        </div>
      ) : visiveis.length === 0 ? (
        <EmptyState
          icone={Search}
          titulo="Nada encontrado"
          descricao="Tente outra cidade, outro tipo, ou desative o filtro 'só sem site'."
        />
      ) : (
        <div className="space-y-2.5">
          {visiveis.map((r) => {
            const cadastrado = jaCadastrado(r)
            const marcado = selecionados.has(r.osmId)
            return (
              <div
                key={r.osmId}
                className={`card p-3.5 transition-colors ${marcado ? 'border-whatsapp/40 bg-whatsapp/5' : ''} ${
                  cadastrado ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => !cadastrado && toggle(r.osmId)}
                    disabled={cadastrado}
                    className="mt-0.5 shrink-0 text-slate-400 enabled:hover:text-whatsapp disabled:cursor-not-allowed"
                    title={cadastrado ? 'Já está nos seus leads' : 'Selecionar'}
                  >
                    {marcado ? (
                      <CheckSquare size={20} className="text-whatsapp" />
                    ) : (
                      <Square size={20} />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-100">{r.nome}</span>
                      <span className="rounded-md bg-surface-800 px-2 py-0.5 text-[11px] text-slate-400">
                        {r.tipoLabel}
                      </span>
                      {r.temSite ? (
                        <a
                          href={r.site.startsWith('http') ? r.site : `https://${r.site}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-surface-800 px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          <Globe size={11} /> tem site <ExternalLink size={9} />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-whatsapp/12 px-2 py-0.5 text-[11px] font-medium text-whatsapp">
                          <GlobeLock size={11} /> sem site
                        </span>
                      )}
                      {cadastrado && (
                        <span className="rounded-md bg-surface-700 px-2 py-0.5 text-[11px] text-slate-400">
                          já é lead
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {r.endereco && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} /> {r.endereco}
                        </span>
                      )}
                      {r.telefone ? (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Phone size={11} /> {formatarTelefone(r.telefone)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <PhoneOff size={11} /> sem telefone
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                    {r.telefone && (
                      <button
                        className="btn-primary !px-3 !py-1.5 text-xs"
                        onClick={() => whatsappIA(r)}
                        disabled={gerandoMsg === r.osmId}
                        title={temIA ? 'Gera mensagem com IA e abre o WhatsApp' : 'Abre o WhatsApp'}
                      >
                        {gerandoMsg === r.osmId ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <MessageCircle size={14} />
                        )}
                        {temIA ? 'WhatsApp IA' : 'WhatsApp'}
                      </button>
                    )}
                    {!cadastrado && (
                      <button
                        className="btn-ghost !px-3 !py-1.5 text-xs"
                        onClick={() => adicionarUm(r)}
                        title="Adicionar como lead"
                      >
                        <Plus size={14} /> Lead
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {infoCidade && resultados.length > 0 && (
        <p className="mt-4 text-center text-[11px] text-slate-600">
          Resultados para {infoCidade.displayName}. Dados © colaboradores do OpenStreetMap.
          Telefones e sites dependem do que está cadastrado no mapa.
        </p>
      )}
    </div>
  )
}
