import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  Building2,
  Phone,
  Tags,
  Clock,
  Plus,
  X,
  Save,
  Trash2,
  Database,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  LogOut,
  Cloud,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { useConfig } from '../hooks/useConfig'
import { useStore } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { validarTelefone, formatarTelefone } from '../utils/whatsapp'
import { MODELO_PADRAO, testarConexaoIA } from '../utils/aiAgent'

export default function Config() {
  const { config, atualizarConfig, adicionarSegmento, removerSegmento } = useConfig()
  const { resetarTudo, nuvem } = useStore()
  const { usuario, sair } = useAuth()

  const [nomeEmpresa, setNomeEmpresa] = useState(config.nomeEmpresa)
  const [telefone, setTelefone] = useState(config.telefone)
  const [intervalo, setIntervalo] = useState(config.intervaloDisparo)
  const [novoSegmento, setNovoSegmento] = useState('')
  const [resetar, setResetar] = useState(false)

  const [apiKey, setApiKey] = useState(config.iaApiKey || '')
  const [modelo, setModelo] = useState(config.iaModelo || MODELO_PADRAO)
  const [mostrarKey, setMostrarKey] = useState(false)
  const [testando, setTestando] = useState(false)

  const salvarIA = () => {
    atualizarConfig({ iaApiKey: apiKey.trim(), iaModelo: modelo.trim() || MODELO_PADRAO })
    toast.success(apiKey.trim() ? 'Agente de IA configurado!' : 'Chave removida — IA desativada.')
  }

  const testarIA = async () => {
    if (!apiKey.trim()) return toast.error('Cole sua chave da API primeiro.')
    setTestando(true)
    try {
      await testarConexaoIA({ iaApiKey: apiKey.trim(), iaModelo: modelo.trim() || MODELO_PADRAO })
      atualizarConfig({ iaApiKey: apiKey.trim(), iaModelo: modelo.trim() || MODELO_PADRAO })
      toast.success('Conexão com a IA funcionando! ✅')
    } catch (e) {
      toast.error(e.message || 'Falha ao conectar.')
    } finally {
      setTestando(false)
    }
  }

  const salvar = (e) => {
    e.preventDefault()
    if (telefone && !validarTelefone(telefone)) {
      return toast.error('Telefone de contato inválido.')
    }
    atualizarConfig({
      nomeEmpresa: nomeEmpresa.trim(),
      telefone: telefone.trim(),
      intervaloDisparo: Math.max(0, Math.min(30, Number(intervalo) || 0)),
    })
    toast.success('Configurações salvas!')
  }

  const addSegmento = () => {
    const s = novoSegmento.trim()
    if (!s) return
    adicionarSegmento(s)
    setNovoSegmento('')
    toast.success('Segmento adicionado.')
  }

  const limparTudo = () => {
    resetarTudo()
    toast.success('Dados apagados.')
  }

  return (
    <div>
      <PageHeader
        titulo="Configurações"
        subtitulo="Dados do seu negócio e preferências de disparo."
      />

      {nuvem && (
        <div className="card mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-whatsapp/12 text-whatsapp">
              <Cloud size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-content-100">Conta conectada</p>
              <p className="text-xs text-content-500">{usuario?.email} · dados sincronizados na nuvem</p>
            </div>
          </div>
          <button
            className="btn-ghost shrink-0"
            onClick={async () => {
              await sair()
              toast.success('Você saiu da conta.')
            }}
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Dados do negócio */}
        <form onSubmit={salvar} className="card space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-content-100">
            <Building2 size={18} className="text-whatsapp" /> Dados do negócio
          </h2>
          <div>
            <label className="label">Nome do profissional / empresa</label>
            <input
              className="input"
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              placeholder="Ex: Magno — Criação de Sites"
            />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Phone size={13} /> Telefone de contato
            </label>
            <input
              className="input"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="11 99999-9999"
              inputMode="tel"
            />
            {telefone && validarTelefone(telefone) && (
              <p className="mt-1 text-xs text-whatsapp">{formatarTelefone(telefone)}</p>
            )}
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Clock size={13} /> Intervalo entre aberturas no disparo (segundos)
            </label>
            <input
              type="number"
              min="0"
              max="30"
              className="input"
              value={intervalo}
              onChange={(e) => setIntervalo(e.target.value)}
            />
            <p className="mt-1 text-xs text-content-500">
              Tempo de espera entre abrir cada conversa no "Abrir todos". Recomendado: 2s.
            </p>
          </div>
          <button type="submit" className="btn-primary w-full">
            <Save size={16} /> Salvar configurações
          </button>
        </form>

        {/* Segmentos */}
        <div className="card space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-content-100">
            <Tags size={18} className="text-whatsapp" /> Segmentos-alvo
          </h2>
          <p className="text-sm text-content-400">
            Nichos que você atende. Aparecem como sugestão ao cadastrar leads.
          </p>
          <div className="flex gap-2">
            <input
              className="input"
              value={novoSegmento}
              onChange={(e) => setNovoSegmento(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSegmento())}
              placeholder="Ex: Pet shops"
            />
            <button className="btn-primary shrink-0" onClick={addSegmento} type="button">
              <Plus size={16} /> Adicionar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.segmentos.length === 0 && (
              <p className="text-sm text-content-500">Nenhum segmento cadastrado.</p>
            )}
            {config.segmentos.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-800 py-1.5 pl-3 pr-2 text-sm text-content-200"
              >
                {s}
                <button
                  onClick={() => removerSegmento(s)}
                  className="rounded-full p-0.5 text-content-500 hover:bg-surface-600 hover:text-red-400"
                  title="Remover"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Agente de IA */}
      <div className="card mt-6 space-y-4 p-5">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-content-100">
            <Sparkles size={18} className="text-whatsapp" /> Agente de IA
          </h2>
          {config.iaApiKey ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-whatsapp/15 px-2 py-0.5 text-[11px] font-medium text-whatsapp">
              <CheckCircle2 size={12} /> ativo
            </span>
          ) : (
            <span className="rounded-full bg-surface-700 px-2 py-0.5 text-[11px] text-content-400">
              desativado
            </span>
          )}
        </div>
        <p className="text-sm text-content-400">
          Opcional. Com uma chave da API da Claude, a <strong>Busca inteligente</strong> interpreta
          pedidos em linguagem natural ("restaurantes em Campinas sem site") e gera mensagens de
          primeiro contato sob medida. Sem chave, a busca por tipo + cidade funciona normalmente.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Chave da API (Claude)</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={mostrarKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setMostrarKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-content-500 hover:text-content-300"
                title={mostrarKey ? 'Ocultar' : 'Mostrar'}
              >
                {mostrarKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-content-500">
              Crie a sua em{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-whatsapp hover:underline"
              >
                console.anthropic.com
              </a>
              .
            </p>
          </div>
          <div>
            <label className="label">Modelo</label>
            <input
              className="input"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder={MODELO_PADRAO}
            />
            <p className="mt-1 text-xs text-content-500">
              Padrão: {MODELO_PADRAO} (rápido e econômico).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={salvarIA}>
            <Save size={16} /> Salvar
          </button>
          <button className="btn-ghost" onClick={testarIA} disabled={testando}>
            {testando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {testando ? 'Testando...' : 'Testar conexão'}
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300/90">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            Atenção: por ser um app sem servidor, a chave fica salva neste navegador e é usada em
            chamadas diretas à API da Claude. Use uma chave só para isso e defina limites de gasto no
            painel da Anthropic. Não use este campo em computadores compartilhados.
          </span>
        </div>
      </div>

      {/* Zona de dados */}
      <div className="card mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-content-100">
            <Database size={17} className="text-content-400" /> Dados locais
          </h2>
          <p className="mt-1 text-sm text-content-500">
            Tudo é salvo apenas neste navegador (localStorage). Apagar não pode ser desfeito.
          </p>
        </div>
        <button className="btn-danger shrink-0" onClick={() => setResetar(true)}>
          <Trash2 size={16} /> Apagar todos os dados
        </button>
      </div>

      <ConfirmDialog
        aberto={resetar}
        aoFechar={() => setResetar(false)}
        aoConfirmar={limparTudo}
        titulo="Apagar todos os dados"
        mensagem="Isso vai remover todos os leads, templates e configurações deste navegador. Tem certeza?"
        textoConfirmar="Apagar tudo"
      />
    </div>
  )
}
