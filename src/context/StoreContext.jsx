import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase, supabaseConfigurado, TABELA_DADOS } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { uuid, agora } from '../utils/format'
import { apenasDigitos } from '../utils/whatsapp'
import { CONFIG_PADRAO, criarTemplatesPadrao, criarLeadsExemplo } from '../data/defaults'
import { limparAntigos } from '../utils/retencao'
import { usePlano } from '../hooks/usePlano'
import { vagasRestantes } from '../utils/planos'

const StoreContext = createContext(null)

const CHAVE_LEADS = 'prospecta:leads'
const CHAVE_TEMPLATES = 'prospecta:templates'
const CHAVE_CONFIG = 'prospecta:config'

function lerJSON(chave) {
  try {
    const v = localStorage.getItem(chave)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}

function estadoLocalInicial() {
  return {
    leads: lerJSON(CHAVE_LEADS) ?? criarLeadsExemplo(),
    templates: lerJSON(CHAVE_TEMPLATES) ?? criarTemplatesPadrao(),
    config: { ...CONFIG_PADRAO, ...(lerJSON(CHAVE_CONFIG) || {}) },
  }
}

function estadoParaMigrar() {
  // usado ao migrar dados locais para a nuvem no primeiro login
  const leads = lerJSON(CHAVE_LEADS)
  const templates = lerJSON(CHAVE_TEMPLATES)
  const config = lerJSON(CHAVE_CONFIG)
  const temAlgo = (leads && leads.length) || (templates && templates.length) || config
  if (!temAlgo) return null
  return {
    leads: leads || [],
    templates: templates || criarTemplatesPadrao(),
    config: { ...CONFIG_PADRAO, ...(config || {}) },
  }
}

function estadoPadraoNuvem() {
  return {
    leads: [],
    templates: criarTemplatesPadrao(),
    config: { ...CONFIG_PADRAO },
  }
}

export function StoreProvider({ children }) {
  const { usuario } = useAuth()
  const nuvem = supabaseConfigurado && Boolean(usuario)
  const userId = usuario?.id || null

  const { plano, ehPremium, pode, maxLeads } = usePlano()

  const [estado, setEstado] = useState(() => (nuvem ? null : estadoLocalInicial()))
  const [carregado, setCarregado] = useState(!nuvem)
  const [sincronizando, setSincronizando] = useState(false)
  const [limpezaRecente, setLimpezaRecente] = useState(0)
  const [erroSync, setErroSync] = useState(false)
  const timerRef = useRef(null)

  // Carregamento (nuvem)
  useEffect(() => {
    if (!nuvem) {
      setEstado(estadoLocalInicial())
      setCarregado(true)
      return
    }
    let ativo = true
    setCarregado(false)
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from(TABELA_DADOS)
          .select('dados')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw error
        if (!ativo) return

        if (data && data.dados && Object.keys(data.dados).length) {
          const d = data.dados
          const daNuvem = {
            leads: d.leads || [],
            templates: d.templates || criarTemplatesPadrao(),
            config: { ...CONFIG_PADRAO, ...(d.config || {}) },
            // telefones de leads já apagados pela retenção, para não reabordar
            jaAbordados: d.jaAbordados || [],
          }
          // Limpa os antigos assim que entra. O `estado` resultante é o mesmo
          // objeto quando nada expira, então isso não gera escrita à toa.
          const { estado: limpo, removidos } = limparAntigos(daNuvem)
          if (removidos > 0) {
            console.info(`Retenção: ${removidos} lead(s) antigo(s) removido(s).`)
            setLimpezaRecente(removidos)
          }
          setEstado(limpo)
        } else {
          // primeiro acesso: migra dados locais se existirem, senão padrão
          const inicial = estadoParaMigrar() || estadoPadraoNuvem()
          setEstado(inicial)
          await supabase.from(TABELA_DADOS).upsert({
            user_id: userId,
            dados: inicial,
            atualizado_em: agora(),
          })
        }
        setCarregado(true)
        setErroSync(false)
      } catch (e) {
        console.error('Erro ao carregar da nuvem:', e)
        // fallback: cache local por usuário, senão padrão
        const cache = lerJSON(`prospecta:cache:${userId}`)
        setEstado(cache || estadoPadraoNuvem())
        setCarregado(true)
        setErroSync(true)
      }
    })()
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuvem, userId])

  // Salvamento (debounced)
  useEffect(() => {
    if (!carregado || !estado) return

    if (!nuvem) {
      localStorage.setItem(CHAVE_LEADS, JSON.stringify(estado.leads))
      localStorage.setItem(CHAVE_TEMPLATES, JSON.stringify(estado.templates))
      localStorage.setItem(CHAVE_CONFIG, JSON.stringify(estado.config))
      return
    }

    // cache local imediato (offline / recarregar rápido)
    localStorage.setItem(`prospecta:cache:${userId}`, JSON.stringify(estado))

    setSincronizando(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase.from(TABELA_DADOS).upsert({
          user_id: userId,
          dados: estado,
          atualizado_em: agora(),
        })
        if (error) throw error
        setErroSync(false)
      } catch (e) {
        console.error('Erro ao sincronizar:', e)
        setErroSync(true)
      } finally {
        setSincronizando(false)
      }
    }, 700)

    return () => clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, carregado, nuvem, userId])

  // Helpers de atualização
  const setLeads = (fn) => setEstado((e) => ({ ...e, leads: fn(e.leads) }))
  const setTemplates = (fn) => setEstado((e) => ({ ...e, templates: fn(e.templates) }))
  const setConfig = (fn) => setEstado((e) => ({ ...e, config: fn(e.config) }))

  // ---- Operações de LEADS ----
  const adicionarLead = (dados) => {
    if (vagasRestantes(plano, (estado?.leads || []).length) < 1) return null
    const t = agora()
    const novo = {
      id: uuid(),
      nome: dados.nome?.trim() || '',
      empresa: dados.empresa?.trim() || '',
      telefone: apenasDigitos(dados.telefone),
      segmento: dados.segmento?.trim() || '',
      status: dados.status || 'novo',
      site: (dados.site || '').trim(),
      notas: dados.notas?.trim() || '',
      criadoEm: t,
      atualizadoEm: t,
      historico: [{ data: t, acao: 'Lead cadastrado' }],
    }
    setLeads((l) => [novo, ...l])
    return novo
  }

  const atualizarLead = (id, dados) => {
    setLeads((l) =>
      l.map((x) =>
        x.id === id
          ? {
              ...x,
              ...dados,
              telefone: dados.telefone !== undefined ? apenasDigitos(dados.telefone) : x.telefone,
              atualizadoEm: agora(),
            }
          : x
      )
    )
  }

  const excluirLead = (id) => setLeads((l) => l.filter((x) => x.id !== id))

  const mudarStatus = (id, status) => {
    setLeads((l) =>
      l.map((x) =>
        x.id === id
          ? {
              ...x,
              status,
              atualizadoEm: agora(),
              historico: [...(x.historico || []), { data: agora(), acao: `Status alterado para "${status}"` }],
            }
          : x
      )
    )
  }

  const registrarHistorico = (id, entrada) => {
    setLeads((l) =>
      l.map((x) =>
        x.id === id
          ? { ...x, atualizadoEm: agora(), historico: [...(x.historico || []), { data: agora(), ...entrada }] }
          : x
      )
    )
  }

  const marcarContatado = (id, template, mensagem) => {
    setLeads((l) =>
      l.map((x) => {
        if (x.id !== id) return x
        const avancaStatus = x.status === 'novo' ? 'contatado' : x.status
        return {
          ...x,
          status: avancaStatus,
          atualizadoEm: agora(),
          historico: [
            ...(x.historico || []),
            { data: agora(), acao: 'Mensagem enviada via WhatsApp', template: template || undefined, mensagem: mensagem || undefined },
          ],
        }
      })
    )
  }

  const importarLeads = (lista) => {
    const t = agora()
    // Corta no limite do plano. `vagas` é Infinity no premium, então slice()
    // não mexe em nada lá.
    const vagas = vagasRestantes(plano, (estado?.leads || []).length)
    const cabem = vagas === Infinity ? lista : lista.slice(0, vagas)
    const bloqueados = lista.length - cabem.length

    const novos = cabem.map((dados) => ({
      id: uuid(),
      nome: (dados.nome || '').trim(),
      empresa: (dados.empresa || '').trim(),
      telefone: apenasDigitos(dados.telefone),
      segmento: (dados.segmento || '').trim(),
      status: dados.status || 'novo',
      site: (dados.site || '').trim(),
      notas: (dados.notas || '').trim(),
      criadoEm: t,
      atualizadoEm: t,
      historico: [{ data: t, acao: 'Importado' }],
    }))
    if (novos.length) setLeads((l) => [...novos, ...l])
    return { adicionados: novos.length, bloqueados }
  }

  // ---- Operações de TEMPLATES ----
  const adicionarTemplate = (dados) => {
    const novo = { id: uuid(), nome: dados.nome?.trim() || 'Sem título', mensagem: dados.mensagem || '', criadoEm: agora() }
    setTemplates((t) => [...t, novo])
    return novo
  }
  const atualizarTemplate = (id, dados) => setTemplates((t) => t.map((x) => (x.id === id ? { ...x, ...dados } : x)))
  const excluirTemplate = (id) => setTemplates((t) => t.filter((x) => x.id !== id))

  // ---- Operações de CONFIG ----
  const atualizarConfig = (dados) => setConfig((c) => ({ ...c, ...dados }))
  const adicionarSegmento = (segmento) => {
    const s = segmento.trim()
    if (!s) return
    setConfig((c) =>
      c.segmentos.some((x) => x.toLowerCase() === s.toLowerCase()) ? c : { ...c, segmentos: [...c.segmentos, s] }
    )
  }
  const removerSegmento = (segmento) =>
    setConfig((c) => ({ ...c, segmentos: c.segmentos.filter((s) => s !== segmento) }))

  // ---- Reset ----
  const resetarTudo = () => {
    const limpo = { leads: [], templates: criarTemplatesPadrao(), config: { ...CONFIG_PADRAO } }
    setEstado(limpo)
    if (!nuvem) {
      localStorage.removeItem(CHAVE_LEADS)
      localStorage.removeItem(CHAVE_TEMPLATES)
      localStorage.removeItem(CHAVE_CONFIG)
    }
  }

  const valor = {
    nuvem,
    carregado,
    sincronizando,
    erroSync,
    leads: estado?.leads || [],
    templates: estado?.templates || [],
    config: estado?.config || CONFIG_PADRAO,
    // telefones de leads já apagados pela retenção
    jaAbordados: estado?.jaAbordados || [],
    // plano e limites
    plano,
    ehPremium,
    pode,
    maxLeads,
    vagas: vagasRestantes(plano, (estado?.leads || []).length),
    limpezaRecente,
    adicionarLead,
    atualizarLead,
    excluirLead,
    mudarStatus,
    registrarHistorico,
    marcarContatado,
    importarLeads,
    adicionarTemplate,
    atualizarTemplate,
    excluirTemplate,
    atualizarConfig,
    adicionarSegmento,
    removerSegmento,
    resetarTudo,
  }

  return <StoreContext.Provider value={valor}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore precisa estar dentro de StoreProvider')
  return ctx
}
