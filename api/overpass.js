// Proxy do Overpass API rodando no servidor (Vercel Serverless Function).
//
// POR QUE ISSO EXISTE: chamar o Overpass direto do navegador falha por CORS.
// Os servidores do Overpass só mandam o header `Access-Control-Allow-Origin`
// nas respostas de sucesso — quando estão sobrecarregados ou dão erro interno,
// a resposta sai sem o header e o navegador bloqueia antes do nosso código ver
// qualquer coisa. Servidor->servidor não tem CORS, então aqui funciona sempre.

// SÓ servidores com cobertura MUNDIAL podem entrar aqui.
//
// Instâncias regionais (overpass.osm.ch = só Suíça, overpass.osm.jp = só Japão)
// são perigosas: para uma cidade brasileira elas respondem HTTP 200 com zero
// resultados. Isso não parece erro — vira um "Nada encontrado" mentiroso na
// tela, que foi exatamente o sintoma que nos trouxe até aqui.
//
// Cuidado também com aliases: overpass.kumi.systems e overpass.private.coffee
// são a MESMA máquina (mesmo IP), então listar os dois não dá redundância.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
]

// Os servidores públicos às vezes ficam LENTOS (20-45s por resposta) sem
// estarem fora do ar. Tentar um de cada vez com timeout curto fazia todos
// estourarem em sequência. Por isso disparamos todos AO MESMO TEMPO e ficamos
// com o primeiro que devolver um JSON válido — os demais são cancelados.
//
// Orçamento total: precisamos responder ANTES de a Vercel matar a função,
// senão o usuário recebe um 504 cru, sem mensagem de erro aproveitável.
const ORCAMENTO_TOTAL = 52000

// Quando um servidor falha RÁPIDO (502/504 em ~1s, típico de sobrecarga),
// ele volta a ser tentado sozinho depois de uma pausa — sem esperar pelos
// outros. Pausas crescentes para não martelar quem já está sobrecarregado.
const PAUSAS_ENTRE_TENTATIVAS = [2000, 4000, 7000, 10000]
// Não vale começar uma tentativa nova se sobrar menos que isso de prazo.
const MINIMO_PARA_TENTAR = 8000

// Se o deploy reclamar de `maxDuration` (o teto varia conforme o plano),
// pode remover esta linha — aí vale o padrão do plano, e o ORCAMENTO_TOTAL
// acima também precisa cair para algo abaixo desse padrão.
export const config = { maxDuration: 60 }

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

function lerCorpo(req) {
  if (typeof req.body === 'string') return Promise.resolve(req.body)
  if (req.body && typeof req.body === 'object' && typeof req.body.query === 'string') {
    return Promise.resolve(req.body.query)
  }
  return new Promise((resolve, reject) => {
    let dados = ''
    req.on('data', (c) => {
      dados += c
    })
    req.on('end', () => resolve(dados))
    req.on('error', reject)
  })
}

async function tentarEndpoint(endpoint, query, signal) {
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // A política de uso do OSM exige identificar a aplicação.
      'User-Agent': 'Prospecta-CRM/1.0 (prospeccao de clientes; contato via app)',
    },
    body: new URLSearchParams({ data: query }).toString(),
    signal,
  })

  if ([429, 502, 503, 504].includes(resp.status)) throw new Error(`sobrecarregado (${resp.status})`)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

  // O Overpass às vezes responde 200 com uma página de erro em XML/HTML em
  // vez de JSON. Validamos antes do parse para não tratar isso como sucesso.
  const texto = await resp.text()
  if (!texto.trim().startsWith('{')) throw new Error('resposta nao-JSON do servidor')

  const dados = JSON.parse(texto)

  // Erros de execução também vêm dentro do JSON, no campo "remark",
  // acompanhados de uma lista de elementos vazia.
  if (dados.remark && /error|timed out|out of memory/i.test(dados.remark)) {
    throw new Error(dados.remark)
  }

  return dados
}

// Tenta UM servidor repetidas vezes até dar certo ou o prazo acabar.
async function tentarComRetentativas(endpoint, query, signal, prazo, falhas, inicio) {
  const host = new URL(endpoint).host
  for (let i = 0; ; i++) {
    try {
      return await tentarEndpoint(endpoint, query, signal)
    } catch (e) {
      if (signal.aborted) throw e // prazo acabou ou outro servidor já venceu
      // "fetch failed" sozinho não diz nada: o motivo real (ENOTFOUND,
      // ECONNREFUSED, timeout de conexão) vem dentro de e.cause.
      const causa = e.cause ? ` [${e.cause.code || e.cause.message}]` : ''
      const falha = `${host}: ${e.name}: ${e.message}${causa} (${Date.now() - inicio}ms)`
      falhas.push(falha)
      console.error('[overpass]', falha)

      const pausa = PAUSAS_ENTRE_TENTATIVAS[i]
      if (pausa === undefined || prazo - Date.now() - pausa < MINIMO_PARA_TENTAR) throw e
      await esperar(pausa)
      if (signal.aborted) throw e
    }
  }
}

// Dispara a consulta em todos os servidores em paralelo e resolve com o
// primeiro sucesso. Rejeita só quando TODOS desistiram (ou o prazo acabou).
async function correrEmParalelo(query, prazo, falhas) {
  const ctrl = new AbortController()
  const inicio = Date.now()
  const t = setTimeout(() => {
    falhas.push(`prazo de ${ORCAMENTO_TOTAL / 1000}s esgotado sem resposta valida`)
    ctrl.abort()
  }, prazo - inicio)

  try {
    return await Promise.any(
      OVERPASS_ENDPOINTS.map((ep) => tentarComRetentativas(ep, query, ctrl.signal, prazo, falhas, inicio))
    )
  } finally {
    clearTimeout(t)
    ctrl.abort() // cancela os servidores que ainda estavam processando
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Use POST.' })
    return
  }

  let query
  try {
    query = await lerCorpo(req)
  } catch {
    res.status(400).json({ erro: 'Nao consegui ler a consulta.' })
    return
  }

  if (!query || !query.trim()) {
    res.status(400).json({ erro: 'Consulta vazia.' })
    return
  }

  const prazo = Date.now() + ORCAMENTO_TOTAL
  const falhas = []

  try {
    const dados = await correrEmParalelo(query, prazo, falhas)
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600')
    res.status(200).json(dados)
    return
  } catch {
    // todos os servidores desistiram ou o prazo acabou — cai no 503 abaixo
  }

  res.status(503).json({
    erro: 'Os servidores do OpenStreetMap estao instaveis agora. Tente de novo em alguns segundos.',
    detalhe: falhas,
  })
}
