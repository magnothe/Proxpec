import { useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, MessageSquareText, Copy, Sparkles } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { useTemplates } from '../hooks/useTemplates'
import { personalizarMensagem } from '../utils/whatsapp'
import { formatarData } from '../utils/format'

const VARIAVEIS = [
  { chave: '{{nome}}', label: 'Nome' },
  { chave: '{{empresa}}', label: 'Empresa' },
  { chave: '{{segmento}}', label: 'Segmento' },
]

const LEAD_EXEMPLO = {
  nome: 'Ana Paula',
  empresa: 'Cantina da Ana',
  segmento: 'Restaurantes',
}

function TemplateForm({ inicial, aoSalvar, aoFechar }) {
  const [nome, setNome] = useState(inicial?.nome || '')
  const [mensagem, setMensagem] = useState(inicial?.mensagem || '')
  const textareaRef = useRef(null)

  const inserirVariavel = (variavel) => {
    const ta = textareaRef.current
    if (!ta) {
      setMensagem((m) => m + variavel)
      return
    }
    const inicio = ta.selectionStart
    const fim = ta.selectionEnd
    const novo = mensagem.slice(0, inicio) + variavel + mensagem.slice(fim)
    setMensagem(novo)
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = inicio + variavel.length
    })
  }

  const preview = useMemo(() => personalizarMensagem(mensagem, LEAD_EXEMPLO), [mensagem])

  const submeter = (e) => {
    e.preventDefault()
    if (!nome.trim()) return toast.error('Dê um nome ao template.')
    if (!mensagem.trim()) return toast.error('Escreva a mensagem do template.')
    aoSalvar({ nome: nome.trim(), mensagem })
    aoFechar()
  }

  return (
    <form onSubmit={submeter} className="space-y-4">
      <div>
        <label className="label">Nome do template</label>
        <input
          className="input"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Primeiro contato"
          autoFocus
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="label mb-0">Mensagem</label>
          <div className="flex gap-1.5">
            {VARIAVEIS.map((v) => (
              <button
                key={v.chave}
                type="button"
                onClick={() => inserirVariavel(v.chave)}
                className="rounded-md bg-surface-700 px-2 py-1 text-[11px] font-medium text-whatsapp hover:bg-surface-600"
                title={`Inserir ${v.chave}`}
              >
                + {v.label}
              </button>
            ))}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="input min-h-[140px] resize-y font-mono text-[13px] leading-relaxed"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Olá, {{nome}}! Vi que a {{empresa}}..."
        />
        <p className="mt-1 text-xs text-content-500">
          Use as variáveis {VARIAVEIS.map((v) => v.chave).join(', ')} — elas são substituídas
          automaticamente pelos dados de cada lead.
        </p>
      </div>

      {/* Preview */}
      <div>
        <label className="label flex items-center gap-1.5">
          <Sparkles size={13} /> Prévia (com dados de exemplo)
        </label>
        {/* A prévia imita a tela do WhatsApp, então as cores dela são fixas nos
            dois temas — é o visual do WhatsApp, não o do app. Por isso o texto
            aqui dentro também não usa os tokens de tema: sobre o verde escuro
            da bolha, `text-content-100` viraria quase preto no tema claro. */}
        <div className="rounded-xl bg-[#0b141a] p-3">
          <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-sm text-slate-50 shadow">
            {preview || <span className="text-slate-400">A prévia aparece aqui...</span>}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" className="btn-ghost" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary">
          Salvar template
        </button>
      </div>
    </form>
  )
}

export default function Templates() {
  const { templates, adicionarTemplate, atualizarTemplate, excluirTemplate } = useTemplates()
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)

  const abrirNovo = () => {
    setEditando(null)
    setModalAberto(true)
  }
  const abrirEdicao = (t) => {
    setEditando(t)
    setModalAberto(true)
  }

  const salvar = (dados) => {
    if (editando) {
      atualizarTemplate(editando.id, dados)
      toast.success('Template atualizado!')
    } else {
      adicionarTemplate(dados)
      toast.success('Template criado!')
    }
  }

  const copiar = async (t) => {
    try {
      await navigator.clipboard.writeText(t.mensagem)
      toast.success('Mensagem copiada!')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Templates"
        subtitulo="Mensagens prontas com variáveis dinâmicas para personalizar cada contato."
        acoes={
          <button className="btn-primary" onClick={abrirNovo}>
            <Plus size={16} /> Novo template
          </button>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          icone={MessageSquareText}
          titulo="Nenhum template"
          descricao="Crie mensagens reutilizáveis para agilizar sua prospecção."
          acao={
            <button className="btn-primary" onClick={abrirNovo}>
              <Plus size={16} /> Criar template
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="card flex flex-col p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-content-100">{t.nome}</h3>
                  <p className="text-[11px] text-content-500">Criado em {formatarData(t.criadoEm)}</p>
                </div>
                <div className="flex gap-1">
                  <button className="btn-icon" onClick={() => copiar(t)} title="Copiar mensagem">
                    <Copy size={15} />
                  </button>
                  <button className="btn-icon" onClick={() => abrirEdicao(t)} title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button
                    className="btn-icon hover:!text-red-400"
                    onClick={() => setExcluindo(t)}
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="flex-1 rounded-lg bg-surface-950/60 p-3 text-sm leading-relaxed text-content-300">
                {t.mensagem}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        titulo={editando ? 'Editar template' : 'Novo template'}
        largura="max-w-xl"
      >
        {modalAberto && (
          <TemplateForm
            inicial={editando}
            aoSalvar={salvar}
            aoFechar={() => setModalAberto(false)}
          />
        )}
      </Modal>

      <ConfirmDialog
        aberto={Boolean(excluindo)}
        aoFechar={() => setExcluindo(null)}
        aoConfirmar={() => excluindo && excluirTemplate(excluindo.id)}
        titulo="Excluir template"
        mensagem={`Excluir o template "${excluindo?.nome}"?`}
        textoConfirmar="Excluir"
      />
    </div>
  )
}
