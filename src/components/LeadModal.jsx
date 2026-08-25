import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from './Modal'
import { STATUS_LISTA } from '../data/defaults'
import { validarTelefone, formatarTelefone } from '../utils/whatsapp'

const VAZIO = {
  nome: '',
  empresa: '',
  telefone: '',
  segmento: '',
  status: 'novo',
  notas: '',
}

export default function LeadModal({ aberto, aoFechar, aoSalvar, leadInicial, segmentos = [] }) {
  const [form, setForm] = useState(VAZIO)
  const editando = Boolean(leadInicial)

  useEffect(() => {
    if (aberto) {
      setForm(leadInicial ? { ...VAZIO, ...leadInicial } : VAZIO)
    }
  }, [aberto, leadInicial])

  const alterar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  const submeter = (e) => {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast.error('Informe o nome do lead.')
      return
    }
    if (!validarTelefone(form.telefone)) {
      toast.error('Telefone inválido. Use DDD + número (ex: 11 99999-9999).')
      return
    }
    aoSalvar(form)
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={editando ? 'Editar lead' : 'Novo lead'}
      largura="max-w-xl"
    >
      <form onSubmit={submeter} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nome *</label>
            <input
              className="input"
              value={form.nome}
              onChange={alterar('nome')}
              placeholder="Ex: Ana Paula"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Empresa</label>
            <input
              className="input"
              value={form.empresa}
              onChange={alterar('empresa')}
              placeholder="Ex: Cantina da Ana"
            />
          </div>
          <div>
            <label className="label">Telefone (WhatsApp) *</label>
            <input
              className="input"
              value={form.telefone}
              onChange={alterar('telefone')}
              placeholder="11 99999-9999"
              inputMode="tel"
            />
            {form.telefone && validarTelefone(form.telefone) && (
              <p className="mt-1 text-xs text-whatsapp">{formatarTelefone(form.telefone)}</p>
            )}
          </div>
          <div>
            <label className="label">Segmento</label>
            <input
              className="input"
              value={form.segmento}
              onChange={alterar('segmento')}
              placeholder="Ex: Restaurantes"
              list="lista-segmentos"
            />
            <datalist id="lista-segmentos">
              {segmentos.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={alterar('status')}>
              {STATUS_LISTA.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Notas</label>
          <textarea
            className="input min-h-[80px] resize-y"
            value={form.notas}
            onChange={alterar('notas')}
            placeholder="Observações sobre o lead, melhor horário para contato, etc."
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-ghost" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary">
            {editando ? 'Salvar alterações' : 'Adicionar lead'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
