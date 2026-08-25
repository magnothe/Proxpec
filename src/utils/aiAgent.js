// Agente de IA (opcional): interpreta buscas em linguagem natural e gera mensagens.
// Usa a API da Claude com a chave do próprio usuário (guardada no localStorage).
// Sem chave, cai num interpretador por palavras-chave — a busca real continua funcionando.
import { TIPOS_COMERCIO, tipoPorValor } from './overpass'

export const MODELO_PADRAO = 'claude-haiku-4-5-20251001'
const API_URL = 'https://api.anthropic.com/v1/messages'

export function iaDisponivel(config) {
  return Boolean(config?.iaApiKey && config.iaApiKey.trim())
}

async function chamarClaude(config, prompt, maxTokens = 400) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.iaApiKey.trim(),
      'anthropic-version': '2023-06-01',
      // permite chamada direta do navegador (a chave fica exposta no cliente)
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.iaModelo?.trim() || MODELO_PADRAO,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!resp.ok) {
    let detalhe = ''
    try {
      const err = await resp.json()
      detalhe = err?.error?.message || ''
    } catch {}
    if (resp.status === 401) throw new Error('Chave da API inválida. Verifique em Configurações.')
    throw new Error(`Erro na IA (${resp.status})${detalhe ? ': ' + detalhe : ''}.`)
  }
  const data = await resp.json()
  return (data.content || []).map((c) => c.text || '').join('').trim()
}

function extrairJSON(texto) {
  const limpo = texto.replace(/```json/gi, '').replace(/```/g, '').trim()
  const inicio = limpo.indexOf('{')
  const fim = limpo.lastIndexOf('}')
  if (inicio === -1 || fim === -1) throw new Error('Resposta inesperada da IA.')
  return JSON.parse(limpo.slice(inicio, fim + 1))
}

/**
 * Interpreta uma busca em linguagem natural via IA.
 * Retorna { tipo, cidade, semSite }.
 */
export async function interpretarBuscaIA(texto, config) {
  const opcoes = TIPOS_COMERCIO.map((t) => `${t.valor} (${t.label})`).join(', ')
  const prompt = `Você é um assistente de prospecção. Extraia da frase do usuário os parâmetros de busca de comércios.
Frase: "${texto}"

Responda APENAS um JSON válido, sem explicações, no formato:
{"tipo": "<um dos valores>", "cidade": "<nome da cidade>", "semSite": <true|false>}

Valores válidos de "tipo": ${opcoes}.
Regras:
- Escolha o "tipo" que melhor corresponde. Se nada corresponder, use "".
- "cidade": só o nome da cidade (ex: "Campinas"). Se não houver, use "".
- "semSite": true se o usuário quer negócios sem site/página; senão false.`

  const resposta = await chamarClaude(config, prompt, 200)
  const obj = extrairJSON(resposta)
  return {
    tipo: tipoPorValor(obj.tipo) ? obj.tipo : '',
    cidade: (obj.cidade || '').trim(),
    semSite: Boolean(obj.semSite),
  }
}

/**
 * Interpretador por palavras-chave (sem IA).
 */
export function interpretarBuscaHeuristica(texto) {
  const t = ` ${texto.toLowerCase()} `
  let tipo = ''
  for (const cat of TIPOS_COMERCIO) {
    const alvos = [cat.label.toLowerCase(), ...cat.sinonimos]
    if (alvos.some((a) => t.includes(a.toLowerCase()))) {
      tipo = cat.valor
      break
    }
  }
  const semSite = /(sem site|sem página|sem pagina|sem website|não tem site|nao tem site)/.test(t)

  // cidade: pega o que vem depois de "em/na/no/de" até o fim
  let cidade = ''
  const m = texto.match(/\b(?:em|na|no|nas|nos|de|do|da)\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s]+?)\s*$/i)
  if (m) {
    cidade = m[1]
      .replace(/\b(sem|site|página|pagina|website|que|não|nao|tem|têm|com)\b/gi, '')
      .trim()
  }
  return { tipo, cidade, semSite }
}

/**
 * Interpreta a busca — usa IA se disponível, senão heurística.
 */
export async function interpretarBusca(texto, config) {
  if (iaDisponivel(config)) {
    try {
      return await interpretarBuscaIA(texto, config)
    } catch (e) {
      // se a IA falhar, cai na heurística
      return { ...interpretarBuscaHeuristica(texto), _erroIA: e.message }
    }
  }
  return interpretarBuscaHeuristica(texto)
}

/**
 * Gera uma mensagem de primeiro contato personalizada via IA para um negócio.
 */
export async function gerarMensagemIA(negocio, config) {
  const nomeEmpresa = config.nomeEmpresa || 'um profissional de criação de sites'
  const prompt = `Escreva UMA mensagem curta de primeiro contato por WhatsApp, em português brasileiro, tom simpático e profissional (2-4 frases, pode usar 1 emoji).
Eu me chamo/represento: ${nomeEmpresa}. Vendo criação de sites profissionais.
Estou entrando em contato com este negócio:
- Nome: ${negocio.nome}
- Segmento: ${negocio.tipoLabel}
- Cidade: ${negocio.cidade}
- Tem site atualmente: ${negocio.temSite ? 'sim' : 'não (provavelmente precisa de um)'}

A mensagem deve se dirigir ao dono do estabelecimento, mencionar o nome do negócio e despertar interesse em ter/melhorar o site. Responda APENAS com o texto da mensagem, sem aspas e sem comentários.`

  return await chamarClaude(config, prompt, 400)
}

/**
 * Testa a conexão com a API da Claude.
 */
export async function testarConexaoIA(config) {
  const r = await chamarClaude(config, 'Responda apenas: OK', 10)
  return r.length > 0
}
