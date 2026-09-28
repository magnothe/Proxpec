import { useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Upload,
  Download,
  MessageCircle,
  Pencil,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import LeadModal from '../components/LeadModal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { useLeads, filtrarLeads } from '../hooks/useLeads'
import { useTemplates } from '../hooks/useTemplates'
import { useConfig } from '../hooks/useConfig'
import { STATUS, STATUS_LISTA } from '../data/defaults'
import { formatarTelefone, gerarLinkWhatsApp, personalizarMensagem, encontrarTemplate, TEMPLATE_PRIMEIRO_CONTATO } from '../utils/whatsapp'
import { tempoRelativo } from '../utils/format'
import { parseCSV, gerarCSV, baixarCSV } from '../utils/csv'

export default function Leads() {
  const {
    leads,
    adicionarLead,
    atualizarLead,
    excluirLead,
    mudarStatus,
    marcarContatado,
    importarLeads,
  } = useLeads()
  const { templates } = useTemplates()
  const { config } = useConfig()

  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('')
  const [segmento, setSegmento] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const fileRef = useRef(null)

  const segmentosDisponiveis = useMemo(() => {
    const set = new Set([...config.segmentos, ...leads.map((l) => l.segmento).filter(Boolean)])
    return [...set].sort()
  }, [leads, config.segmentos])

  const filtrados = useMemo(
    () => filtrarLeads(leads, { busca, status, segmento }),
    [leads, busca, status, segmento]
  )

  const temFiltro = busca || status || segmento

  const abrirNovo = () => {
    setEditando(null)
    setModalAberto(true)
  }
  const abrirEdicao = (lead) => {
    setEditando(lead)
    setModalAberto(true)
  }

  const salvar = (dados) => {
    if (editando) {
      atualizarLead(editando.id, dados)
      toast.success('Lead atualizado!')
    } else {
      adicionarLead(dados)
      toast.success('Lead adicionado!')
    }
  }

  const confirmarExclusao = () => {
    if (!excluindo) return
    excluirLead(excluindo.id)
    toast.success('Lead excluído.')
  }

  const enviarWhatsApp = (lead) => {
    const template = encontrarTemplate(templates, TEMPLATE_PRIMEIRO_CONTATO)
    const msg = template ? personalizarMensagem(template.mensagem, lead) : `Olá, ${lead.nome}!`
    window.open(gerarLinkWhatsApp(lead.telefone, msg), '_blank', 'noopener')
    marcarContatado(lead.id, template?.nome, msg)
    toast.success(`WhatsApp aberto para ${lead.nome}`)
  }

  const exportar = () => {
    if (leads.length === 0) {
      toast.error('Não há leads para exportar.')
      return
    }
    const csv = gerarCSV(filtrados, [
      { chave: 'nome', titulo: 'nome' },
      { chave: 'empresa', titulo: 'empresa' },
      { chave: 'telefone', titulo: 'telefone' },
      { chave: 'segmento', titulo: 'segmento' },
      { chave: 'status', titulo: 'status' },
    ])
    baixarCSV(`leads-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    toast.success(`${filtrados.length} lead(s) exportado(s).`)
  }

  const importar = (e) => {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const registros = parseCSV(String(reader.result))
        const validos = registros.filter((r) => (r.nome || '').trim() || (r.telefone || '').trim())
        if (validos.length === 0) {
          toast.error('Nenhum lead válido encontrado. Verifique o cabeçalho: nome, telefone, empresa, segmento.')
          return
        }
        const { adicionados } = importarLeads(validos)
        if (adicionados) toast.success(`${adicionados} lead(s) importado(s) com sucesso!`)
      } catch (err) {
        console.error(err)
        toast.error('Erro ao ler o arquivo CSV.')
      }
    }
    reader.readAsText(arquivo, 'UTF-8')
    e.target.value = ''
  }

  const limparFiltros = () => {
    setBusca('')
    setStatus('')
    setSegmento('')
  }

  return (
    <div>
      <PageHeader
        titulo="Leads"
        subtitulo={`${leads.length} lead(s) no total · ${filtrados.length} exibido(s)`}
        acoes={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={importar}
            />
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Importar CSV
            </button>
            <button className="btn-ghost" onClick={exportar}>
              <Download size={16} /> Exportar
            </button>
            <button className="btn-primary" onClick={abrirNovo}>
              <Plus size={16} /> Novo lead
            </button>
          </>
        }
      />

      {/* Filtros */}
      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Buscar por nome ou empresa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select className="input sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_LISTA.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="input sm:w-48"
          value={segmento}
          onChange={(e) => setSegmento(e.target.value)}
        >
          <option value="">Todos os segmentos</option>
          {segmentosDisponiveis.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {temFiltro && (
          <button className="btn-ghost sm:w-auto" onClick={limparFiltros} title="Limpar filtros">
            <X size={16} /> Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      {filtrados.length === 0 ? (
        <EmptyState
          icone={Users}
          titulo={temFiltro ? 'Nenhum lead encontrado' : 'Nenhum lead cadastrado'}
          descricao={
            temFiltro
              ? 'Tente ajustar os filtros de busca.'
              : 'Adicione manualmente ou importe uma lista via CSV.'
          }
          acao={
            !temFiltro && (
              <button className="btn-primary" onClick={abrirNovo}>
                <Plus size={16} /> Adicionar lead
              </button>
            )
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Segmento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Última interação</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {filtrados.map((lead) => (
                  <tr key={lead.id} className="group hover:bg-surface-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-700 text-xs font-semibold text-slate-300">
                          {lead.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-100">{lead.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{lead.empresa || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {lead.telefone ? formatarTelefone(lead.telefone) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {lead.segmento ? (
                        <span className="rounded-md bg-surface-800 px-2 py-1 text-xs text-slate-300">
                          {lead.segmento}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        onChange={(e) => {
                          mudarStatus(lead.id, e.target.value)
                          toast.success(`Status: ${STATUS[e.target.value].label}`)
                        }}
                        className="cursor-pointer rounded-full border-0 bg-transparent px-0 py-0 text-xs focus:outline-none focus:ring-0"
                        style={{ color: STATUS[lead.status]?.cor }}
                        title="Mudar status"
                      >
                        {STATUS_LISTA.map((s) => (
                          <option key={s.valor} value={s.valor} className="bg-surface-800 text-slate-200">
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {tempoRelativo(lead.atualizadoEm)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="btn-icon !text-whatsapp hover:!bg-whatsapp/10"
                          onClick={() => enviarWhatsApp(lead)}
                          title="Enviar WhatsApp"
                        >
                          <MessageCircle size={17} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => abrirEdicao(lead)}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn-icon hover:!text-red-400"
                          onClick={() => setExcluindo(lead)}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LeadModal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoSalvar={salvar}
        leadInicial={editando}
        segmentos={segmentosDisponiveis}
      />

      <ConfirmDialog
        aberto={Boolean(excluindo)}
        aoFechar={() => setExcluindo(null)}
        aoConfirmar={confirmarExclusao}
        titulo="Excluir lead"
        mensagem={`Tem certeza que deseja excluir "${excluindo?.nome}"? Esta ação não pode ser desfeita.`}
        textoConfirmar="Excluir"
      />
    </div>
  )
}
