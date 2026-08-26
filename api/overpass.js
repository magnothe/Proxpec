// Proxy do Overpass API rodando no servidor (Vercel Serverless Function).
//
// POR QUE ISSO EXISTE: chamar o Overpass direto do navegador falha por CORS.
// Os servidores do Overpass só mandam o header `Access-Control-Allow-Origin`
// nas respostas de sucesso — quando estão sobrecarregados ou dão erro interno,
// a resposta sai sem o header e o navegador bloqueia antes do nosso código ver
// qualquer coisa. Servidor->servidor não tem CORS, então aqui funciona sempre.

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
]

const RODADAS = 2
const TIMEOUT_POR_TENTATIVA = 15000

// Orçamento total: precisamos responder ANTES de a Vercel matar a função,
// senão o usuário recebe um 504 cru, sem mensagem de erro aproveitável.
const ORCAMENTO_TOTAL = 50000

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

async function tentarEndpoint(endpoint, query) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_POR_TENTATIVA)
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // A política de uso do OSM exige identificar a aplicação.
        'User-Agent': 'Prospecta-CRM/1.0 (prospeccao de clientes; contato via app)',
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: ctrl.signal,
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
  } finally {
    clearTimeout(t)
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
  let ultimoErro = null

  for (let rodada = 0; rodada < RODADAS; rodada++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      // Sem tempo para mais uma tentativa completa: para agora e responde
      // com erro tratado, em vez de ser cortado no meio pela plataforma.
      if (Date.now() + TIMEOUT_POR_TENTATIVA > prazo) break
      try {
        const dados = await tentarEndpoint(endpoint, query)
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600')
        res.status(200).json(dados)
        return
      } catch (e) {
        ultimoErro = `${new URL(endpoint).host}: ${e.message}`
        console.error('[overpass]', ultimoErro)
      }
    }
    if (rodada < RODADAS - 1) await esperar(1000)
  }

  res.status(503).json({
    erro: 'Os servidores do OpenStreetMap estao instaveis agora. Tente de novo em alguns segundos.',
    detalhe: ultimoErro,
  })
}
