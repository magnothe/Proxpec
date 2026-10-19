import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase, supabaseConfigurado } from '../lib/supabase'
import { lerChaveIA, gravarChaveIA } from '../lib/chaveIA'
import { useAuth } from './AuthContext'
import { uuid, agora } from '../utils/format'
import { apenasDigitos } from '../utils/whatsapp'
import { CONFIG_PADRAO, criarTemplatesPadrao, criarLeadsExemplo } from '../data/defaults'
import { limparAntigos } from '../utils/retencao'

// =====================================================================
// Este contexto serve os mesmos dados de duas origens bem diferentes:
//
//   MODO LOCAL (sem Supabase configurado) — tudo no localStorage, um objeto
//   por chave. É o modo de segurança: sem login, sem nuvem.
//
//   MODO NUVEM — tabelas normalizadas no Postgres (leads, lead_historico,
//   templates, user_config, ja_abordados). Antes disto era um único JSONB
//   reescrito por inteiro a cada alteração; ver docs/supabase-migracao-02.sql.
//
// As telas não sabem em qual modo estão: a API exposta aqui embaixo é a mesma
// nos dois casos, e o formato dos objetos (camelCase, `historico` dentro do
// lead) é preservado para que nenhuma página precise mudar.
//
// ESCRITAS SÃO OTIMISTAS: o estado local muda na hora e a ida ao banco
// acontece em seguida. É o que mantém a interface instantânea. Se a gravação
// falhar, `erroSync` acende e o indicador no menu lateral avisa. Isso é
// possível porque os ids são gerados no cliente (`uuid()`), então a linha
// local já nasce com o mesmo id que terá no banco.
// =====================================================================

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
    jaAbordados: [],
  }
}

// ---------------------------------------------------------------------
// Tradução entre o banco (snake_case, histórico em tabela separada) e o
// formato que as telas já consomem (camelCase, histórico dentro do lead).
// ---------------------------------------------------------------------

function leadDoBanco(row, historico) {
  return {
    id: row.id,
    nome: row.nome || '',
    empresa: row.empresa || '',
    telefone: row.telefone || '',
    segmento: row.segmento || '',
    status: row.status || 'novo',
    site: row.site || '',
    notas: row.notas || '',
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    historico: historico || [],
  }
}

/** Só as colunas que a tabela `leads` conhece — `historico` e as datas de
 *  servidor ficam de fora de propósito. */
function leadParaBanco(lead, userId) {
  return {
    id: lead.id,
    user_id: userId,
    nome: lead.nome || '',
    empresa: lead.empresa || '',
    telefone: lead.telefone || '',
    segmento: lead.segmento || '',
    status: lead.status || 'novo',
    site: lead.site || '',
    notas: lead.notas || '',
    criado_em: lead.criadoEm || agora(),
  }
}

/** Mapeamento explícito de propósito: espalhar o objeto do app com `...t`
 *  mandaria junto `criadoEm`, que não é coluna, e o PostgREST recusa a linha
 *  inteira ao ver um campo que não existe na tabela. */
function templateParaBanco(t, userId) {
  return {
    id: t.id,
    user_id: userId,
    nome: t.nome,
    mensagem: t.mensagem,
    criado_em: t.criadoEm,
  }
}

function templateDoBanco(row) {
  return {
    id: row.id,
    nome: row.nome,
    mensagem: row.mensagem,
    criadoEm: row.criado_em,
  }
}

function configDoBanco(row) {
  return {
    ...CONFIG_PADRAO,
    nomeEmpresa: row?.nome_empresa ?? CONFIG_PADRAO.nomeEmpresa,
    telefone: row?.telefone ?? '',
    segmentos: row?.segmentos?.length ? row.segmentos : CONFIG_PADRAO.segmentos,
    intervaloDisparo: row?.intervalo_disparo ?? CONFIG_PADRAO.intervaloDisparo,
    iaModelo: row?.ia_modelo || CONFIG_PADRAO.iaModelo,
    // Nunca vem do banco — ver src/lib/chaveIA.js.
    iaApiKey: lerChaveIA(),
  }
}

function configParaBanco(config, userId) {
  return {
    user_id: userId,
    nome_empresa: config.nomeEmpresa || '',
    telefone: config.telefone || '',
    segmentos: config.segmentos || [],
    intervalo_disparo: Number(config.intervaloDisparo) || 0,
    ia_modelo: config.iaModelo || CONFIG_PADRAO.iaModelo,
  }
}

export function StoreProvider({ children }) {
  const { usuario } = useAuth()
  const nuvem = supabaseConfigurado && Boolean(usuario)
  const userId = usuario?.id || null

  const [estado, setEstado] = useState(() => (nuvem ? null : estadoLocalInicial()))
  const [carregado, setCarregado] = useState(!nuvem)
  const [sincronizando, setSincronizando] = useState(false)
  const [erroSync, setErroSync] = useState(false)

  // Quantas gravações estão no ar agora. Um contador em vez de um booleano
  // porque várias escritas podem se sobrepor: com booleano, a primeira a
  // terminar apagaria o indicador enquanto as outras ainda estivessem indo.
  const pendentes = useRef(0)

  // -------------------------------------------------------------------
  // Carregamento
  // -------------------------------------------------------------------
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
        // As quatro consultas são independentes, então vão juntas. Em série
        // seriam quatro idas e voltas enfileiradas na abertura do app.
        const [resLeads, resHist, resTemplates, resConfig, resAbordados] = await Promise.all([
          supabase.from('leads').select('*').order('atualizado_em', { ascending: false }),
          supabase.from('lead_historico').select('*').order('data', { ascending: true }),
          supabase.from('templates').select('*').order('criado_em', { ascending: true }),
          supabase.from('user_config').select('*').eq('user_id', userId).maybeSingle(),
          supabase.from('ja_abordados').select('telefone'),
        ])

        const erro =
          resLeads.error || resHist.error || resTemplates.error ||
          resConfig.error || resAbordados.error
        if (erro) throw erro
        if (!ativo) return

        // Agrupa o histórico por lead uma vez só. Procurar dentro do array a
        // cada lead seria O(leads × eventos).
        const porLead = new Map()
        for (const h of resHist.data || []) {
          const lista = porLead.get(h.lead_id)
          const evento = {
            data: h.data,
            acao: h.acao,
            ...(h.template ? { template: h.template } : {}),
            ...(h.mensagem ? { mensagem: h.mensagem } : {}),
          }
          if (lista) lista.push(evento)
          else porLead.set(h.lead_id, [evento])
        }

        const leads = (resLeads.data || []).map((r) => leadDoBanco(r, porLead.get(r.id)))

        // Primeiro acesso: a conta ainda não tem linha de configuração nem
        // templates. Semeia os padrões para a pessoa não cair num app vazio.
        let templates = (resTemplates.data || []).map(templateDoBanco)
        if (!templates.length) {
          const padrao = criarTemplatesPadrao()
          const { error } = await supabase
            .from('templates')
            .insert(padrao.map((t) => templateParaBanco(t, userId)))
          // Se a semeadura falhar, seguimos com os padrões só em memória: é
          // melhor abrir o app com os modelos do que com a tela vazia.
          templates = padrao
          if (error) console.error('Não consegui semear os templates padrão:', error)
        }

        if (!resConfig.data) {
          await supabase.from('user_config').insert(configParaBanco(CONFIG_PADRAO, userId))
        }

        setEstado({
          leads,
          templates,
          config: configDoBanco(resConfig.data),
          jaAbordados: (resAbordados.data || []).map((a) => a.telefone),
        })
        setCarregado(true)
        setErroSync(false)
      } catch (e) {
        console.error('Erro ao carregar da nuvem:', e)
        if (!ativo) return
        // Cache local por usuário, para o app abrir mesmo offline.
        const cache = lerJSON(`prospecta:cache:${userId}`)
        setEstado(cache || { leads: [], templates: criarTemplatesPadrao(), config: { ...CONFIG_PADRAO }, jaAbordados: [] })
        setCarregado(true)
        setErroSync(true)
      }
    })()

    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuvem, userId])

  // -------------------------------------------------------------------
  // Persistência
  // -------------------------------------------------------------------

  // Modo local: grava o estado inteiro, que aqui é barato (é tudo memória).
  useEffect(() => {
    if (!carregado || !estado || nuvem) return
    localStorage.setItem(CHAVE_LEADS, JSON.stringify(estado.leads))
    localStorage.setItem(CHAVE_TEMPLATES, JSON.stringify(estado.templates))
    localStorage.setItem(CHAVE_CONFIG, JSON.stringify(estado.config))
  }, [estado, carregado, nuvem])

  // Modo nuvem: o cache é só rede de segurança para abrir offline. A fonte
  // da verdade são as tabelas, atualizadas comando a comando logo abaixo.
  useEffect(() => {
    if (!carregado || !estado || !nuvem) return
    try {
      localStorage.setItem(`prospecta:cache:${userId}`, JSON.stringify(estado))
    } catch {
      // Cota estourada: seguimos sem cache, a nuvem continua valendo.
    }
  }, [estado, carregado, nuvem, userId])

  /**
   * Envia uma escrita ao banco e cuida dos indicadores.
   *
   * Em modo local vira um no-op, então cada operação abaixo pode chamar sem
   * perguntar em que modo está. O `erro` nunca sobe: a interface já aplicou
   * a mudança de forma otimista, e o que o usuário precisa saber é que a
   * sincronização falhou — é isso que `erroSync` comunica.
   */
  const gravar = useCallback(
    async (fn) => {
      if (!nuvem) return
      pendentes.current += 1
      setSincronizando(true)
      try {
        const { error } = await fn()
        if (error) throw error
        setErroSync(false)
      } catch (e) {
        console.error('Erro ao sincronizar:', e)
        setErroSync(true)
      } finally {
        pendentes.current -= 1
        if (pendentes.current === 0) setSincronizando(false)
      }
    },
    [nuvem]
  )

  // Helpers de estado local
  const setLeads = (fn) => setEstado((e) => ({ ...e, leads: fn(e.leads) }))
  const setTemplates = (fn) => setEstado((e) => ({ ...e, templates: fn(e.templates) }))
  const setConfig = (fn) => setEstado((e) => ({ ...e, config: fn(e.config) }))

  // -------------------------------------------------------------------
  // LEADS
  // -------------------------------------------------------------------

  const adicionarLead = (dados) => {
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

    gravar(async () => {
      const { error } = await supabase.from('leads').insert(leadParaBanco(novo, userId))
      if (error) return { error }
      return supabase.from('lead_historico').insert({
        lead_id: novo.id,
        user_id: userId,
        data: t,
        acao: 'Lead cadastrado',
      })
    })

    return novo
  }

  const atualizarLead = (id, dados) => {
    const limpo = {
      ...dados,
      ...(dados.telefone !== undefined ? { telefone: apenasDigitos(dados.telefone) } : {}),
    }
    setLeads((l) => l.map((x) => (x.id === id ? { ...x, ...limpo, atualizadoEm: agora() } : x)))

    gravar(() => {
      // Só manda o que mudou. `historico` nunca entra: é tabela à parte.
      const { historico, criadoEm, atualizadoEm, id: _id, ...resto } = limpo
      const patch = {}
      for (const [k, v] of Object.entries(resto)) {
        const coluna = { nome: 'nome', empresa: 'empresa', telefone: 'telefone',
                         segmento: 'segmento', status: 'status', site: 'site',
                         notas: 'notas' }[k]
        if (coluna) patch[coluna] = v
      }
      return supabase.from('leads').update(patch).eq('id', id)
    })
  }

  const excluirLead = (id) => {
    setLeads((l) => l.filter((x) => x.id !== id))
    // O histórico vai junto pelo `on delete cascade` da tabela.
    gravar(() => supabase.from('leads').delete().eq('id', id))
  }

  const mudarStatus = (id, status) => {
    const t = agora()
    const acao = `Status alterado para "${status}"`
    setLeads((l) =>
      l.map((x) =>
        x.id === id
          ? { ...x, status, atualizadoEm: t, historico: [...(x.historico || []), { data: t, acao }] }
          : x
      )
    )

    gravar(async () => {
      const { error } = await supabase.from('leads').update({ status }).eq('id', id)
      if (error) return { error }
      return supabase.from('lead_historico').insert({ lead_id: id, user_id: userId, data: t, acao })
    })
  }

  const registrarHistorico = (id, entrada) => {
    const t = agora()
    setLeads((l) =>
      l.map((x) =>
        x.id === id
          ? { ...x, atualizadoEm: t, historico: [...(x.historico || []), { data: t, ...entrada }] }
          : x
      )
    )

    gravar(() =>
      supabase.from('lead_historico').insert({
        lead_id: id,
        user_id: userId,
        data: t,
        acao: entrada.acao || 'Evento',
        template: entrada.template || null,
        mensagem: entrada.mensagem || null,
      })
    )
  }

  const marcarContatado = (id, template, mensagem) => {
    const t = agora()
    const acao = 'Mensagem enviada via WhatsApp'

    // O status é decidido AQUI, não dentro do updater do setLeads. React não
    // garante que o updater já rodou quando a próxima linha executa, então
    // uma variável preenchida lá dentro chegaria vazia no `gravar()` abaixo —
    // e o status nunca subiria para o banco.
    const atual = (estado?.leads || []).find((x) => x.id === id)
    if (!atual) return
    // Só avança quem ainda estava em 'novo': quem já está em negociação não
    // deve voltar para 'contatado' por causa de mais uma mensagem.
    const statusNovo = atual.status === 'novo' ? 'contatado' : atual.status
    const mudouStatus = statusNovo !== atual.status

    setLeads((l) =>
      l.map((x) =>
        x.id === id
          ? {
              ...x,
              status: statusNovo,
              atualizadoEm: t,
              historico: [
                ...(x.historico || []),
                { data: t, acao, template: template || undefined, mensagem: mensagem || undefined },
              ],
            }
          : x
      )
    )

    gravar(async () => {
      if (mudouStatus) {
        const { error } = await supabase.from('leads').update({ status: statusNovo }).eq('id', id)
        if (error) return { error }
      }
      return supabase.from('lead_historico').insert({
        lead_id: id,
        user_id: userId,
        data: t,
        acao,
        template: template || null,
        mensagem: mensagem || null,
      })
    })
  }

  const importarLeads = (lista) => {
    const t = agora()
    const novos = lista.map((dados) => ({
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
    if (!novos.length) return { adicionados: 0 }

    setLeads((l) => [...novos, ...l])

    // Importação vem da tela de Buscar e pode trazer dezenas de leads de uma
    // vez. Um insert por lead seriam dezenas de requisições; em lote são duas.
    gravar(async () => {
      const { error } = await supabase
        .from('leads')
        .insert(novos.map((n) => leadParaBanco(n, userId)))
      if (error) return { error }
      return supabase.from('lead_historico').insert(
        novos.map((n) => ({ lead_id: n.id, user_id: userId, data: t, acao: 'Importado' }))
      )
    })

    return { adicionados: novos.length }
  }

  // -------------------------------------------------------------------
  // TEMPLATES
  // -------------------------------------------------------------------

  const adicionarTemplate = (dados) => {
    const novo = {
      id: uuid(),
      nome: dados.nome?.trim() || 'Sem título',
      mensagem: dados.mensagem || '',
      criadoEm: agora(),
    }
    setTemplates((t) => [...t, novo])
    gravar(() => supabase.from('templates').insert(templateParaBanco(novo, userId)))
    return novo
  }

  const atualizarTemplate = (id, dados) => {
    setTemplates((t) => t.map((x) => (x.id === id ? { ...x, ...dados } : x)))
    gravar(() => {
      const patch = {}
      if (dados.nome !== undefined) patch.nome = dados.nome
      if (dados.mensagem !== undefined) patch.mensagem = dados.mensagem
      return supabase.from('templates').update(patch).eq('id', id)
    })
  }

  const excluirTemplate = (id) => {
    setTemplates((t) => t.filter((x) => x.id !== id))
    gravar(() => supabase.from('templates').delete().eq('id', id))
  }

  // -------------------------------------------------------------------
  // CONFIG
  // -------------------------------------------------------------------

  const atualizarConfig = (dados) => {
    // A chave da API é desviada antes de qualquer coisa: ela vai para o
    // navegador e NÃO entra no que será gravado na nuvem.
    if (dados.iaApiKey !== undefined) gravarChaveIA(dados.iaApiKey)

    setConfig((c) => ({ ...c, ...dados }))

    const { iaApiKey, ...paraNuvem } = dados
    if (!Object.keys(paraNuvem).length) return

    gravar(() => {
      const patch = {}
      if (paraNuvem.nomeEmpresa !== undefined) patch.nome_empresa = paraNuvem.nomeEmpresa
      if (paraNuvem.telefone !== undefined) patch.telefone = paraNuvem.telefone
      if (paraNuvem.segmentos !== undefined) patch.segmentos = paraNuvem.segmentos
      if (paraNuvem.intervaloDisparo !== undefined)
        patch.intervalo_disparo = Number(paraNuvem.intervaloDisparo) || 0
      if (paraNuvem.iaModelo !== undefined) patch.ia_modelo = paraNuvem.iaModelo
      return supabase.from('user_config').update(patch).eq('user_id', userId)
    })
  }

  // Os dois calculam a lista nova FORA do `setEstado`. Disparar a gravação de
  // dentro do updater significaria gravar duas vezes no StrictMode, que chama
  // o updater em dobro de propósito para expor justamente este tipo de efeito
  // colateral escondido.
  const segmentosAtuais = estado?.config?.segmentos || []

  const adicionarSegmento = (segmento) => {
    const s = segmento.trim()
    if (!s) return
    if (segmentosAtuais.some((x) => x.toLowerCase() === s.toLowerCase())) return
    const segmentos = [...segmentosAtuais, s]
    setConfig((c) => ({ ...c, segmentos }))
    gravar(() => supabase.from('user_config').update({ segmentos }).eq('user_id', userId))
  }

  const removerSegmento = (segmento) => {
    const segmentos = segmentosAtuais.filter((s) => s !== segmento)
    setConfig((c) => ({ ...c, segmentos }))
    gravar(() => supabase.from('user_config').update({ segmentos }).eq('user_id', userId))
  }

  // -------------------------------------------------------------------
  // RESET
  // -------------------------------------------------------------------

  const resetarTudo = () => {
    const templatesPadrao = criarTemplatesPadrao()
    setEstado({
      leads: [],
      templates: templatesPadrao,
      config: { ...CONFIG_PADRAO, iaApiKey: lerChaveIA() },
      jaAbordados: [],
    })

    if (!nuvem) {
      localStorage.removeItem(CHAVE_LEADS)
      localStorage.removeItem(CHAVE_TEMPLATES)
      localStorage.removeItem(CHAVE_CONFIG)
      return
    }

    gravar(async () => {
      // A ordem importa: `lead_historico` e `ja_abordados` primeiro não é
      // necessário (o histórico cai por cascade), mas apagar leads antes de
      // ja_abordados evita que a retenção, se rodar no meio, repovoe a lista.
      const passos = [
        supabase.from('leads').delete().eq('user_id', userId),
        supabase.from('ja_abordados').delete().eq('user_id', userId),
        supabase.from('templates').delete().eq('user_id', userId),
      ]
      for (const p of passos) {
        const { error } = await p
        if (error) return { error }
      }
      const { error } = await supabase
        .from('templates')
        .insert(templatesPadrao.map((t) => templateParaBanco(t, userId)))
      if (error) return { error }
      return supabase
        .from('user_config')
        .update(configParaBanco(CONFIG_PADRAO, userId))
        .eq('user_id', userId)
    })
  }

  // -------------------------------------------------------------------
  // Retenção
  // -------------------------------------------------------------------
  // Em modo nuvem quem limpa é o banco, pelo job agendado (pg_cron chamando
  // `private.limpar_leads_antigos`). O cliente não mexe mais nisso: fazer os
  // dois lados apagarem a mesma coisa só multiplica o risco de divergirem,
  // que foi o bug corrigido na migração 01.
  //
  // Em modo local não há servidor, então a limpeza acontece aqui, uma vez a
  // cada abertura.
  const [limpezaRecente, setLimpezaRecente] = useState(0)
  const limpezaFeita = useRef(false)

  useEffect(() => {
    if (nuvem || !carregado || !estado || limpezaFeita.current) return
    limpezaFeita.current = true
    const { estado: limpo, removidos } = limparAntigos(estado)
    if (removidos > 0) {
      console.info(`Retenção: ${removidos} lead(s) antigo(s) removido(s).`)
      setLimpezaRecente(removidos)
      setEstado(limpo)
    }
  }, [nuvem, carregado, estado])

  const valor = {
    nuvem,
    carregado,
    sincronizando,
    erroSync,
    leads: estado?.leads || [],
    templates: estado?.templates || [],
    config: estado?.config || CONFIG_PADRAO,
    jaAbordados: estado?.jaAbordados || [],
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
