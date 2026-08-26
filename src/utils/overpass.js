// Busca real de comércios via OpenStreetMap (Nominatim + Overpass API).
// Gratuito e sem chave. O Nominatim (geocodificação) aceita chamada direta do
// navegador; o Overpass não — ele vai pelo nosso backend, veja abaixo.
import { apenasDigitos, ehCelular } from './whatsapp'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

// A consulta ao Overpass passa pelo NOSSO backend (/api/overpass), na mesma
// origem do site. Chamar o Overpass direto do navegador quebra por CORS: os
// servidores dele só mandam o header `Access-Control-Allow-Origin` quando dá
// certo — nas respostas de erro/sobrecarga o header some e o navegador bloqueia
// antes do nosso código conseguir tentar outro servidor.
const OVERPASS_PROXY = '/api/overpass'

// Teto de resultados por busca. O Overpass corta em silêncio ao atingir esse
// número, então avisamos na tela quando a lista veio truncada.
const LIMITE_RESULTADOS = 500

// Dois registros com o mesmo nome a menos disso são o mesmo estabelecimento
// (o OSM costuma ter o mesmo lugar como ponto E como polígono do prédio).
// Acima disso são unidades diferentes de uma rede — e cada uma é um lead.
const RAIO_MESMO_LOCAL_M = 150

// Tipos de comércio mapeados para tags do OpenStreetMap.
export const TIPOS_COMERCIO = [
  { valor: 'restaurante', label: 'Restaurantes', tags: [['amenity', 'restaurant']], sinonimos: ['restaurante', 'restaurantes', 'comida', 'lanchonete de comida'] },
  { valor: 'lanchonete', label: 'Lanchonetes / Fast-food', tags: [['amenity', 'fast_food']], sinonimos: ['lanchonete', 'lanchonetes', 'fast food', 'hamburgueria', 'hamburgueria'] },
  { valor: 'pizzaria', label: 'Pizzarias', tags: [['cuisine', 'pizza']], sinonimos: ['pizzaria', 'pizzarias', 'pizza'] },
  { valor: 'cafe', label: 'Cafeterias', tags: [['amenity', 'cafe']], sinonimos: ['cafeteria', 'cafeterias', 'café', 'cafe'] },
  { valor: 'padaria', label: 'Padarias', tags: [['shop', 'bakery']], sinonimos: ['padaria', 'padarias', 'panificadora'] },
  { valor: 'bar', label: 'Bares', tags: [['amenity', 'bar'], ['amenity', 'pub']], sinonimos: ['bar', 'bares', 'boteco', 'pub'] },
  { valor: 'clinica', label: 'Clínicas médicas', tags: [['amenity', 'clinic'], ['healthcare', 'clinic']], sinonimos: ['clinica', 'clínica', 'clínicas', 'clinicas', 'consultório'] },
  { valor: 'dentista', label: 'Dentistas', tags: [['amenity', 'dentist'], ['healthcare', 'dentist']], sinonimos: ['dentista', 'dentistas', 'odontologia', 'odontológico'] },
  { valor: 'veterinario', label: 'Veterinários', tags: [['amenity', 'veterinary']], sinonimos: ['veterinario', 'veterinário', 'veterinária', 'vet'] },
  { valor: 'farmacia', label: 'Farmácias', tags: [['amenity', 'pharmacy']], sinonimos: ['farmacia', 'farmácia', 'farmácias', 'drogaria'] },
  { valor: 'academia', label: 'Academias', tags: [['leisure', 'fitness_centre']], sinonimos: ['academia', 'academias', 'fitness', 'crossfit', 'musculação'] },
  { valor: 'salao', label: 'Salões de beleza', tags: [['shop', 'hairdresser'], ['shop', 'beauty']], sinonimos: ['salão', 'salao', 'salões', 'beleza', 'estética', 'estetica', 'manicure'] },
  { valor: 'barbearia', label: 'Barbearias', tags: [['shop', 'hairdresser']], sinonimos: ['barbearia', 'barbearias', 'barbeiro'] },
  { valor: 'petshop', label: 'Pet shops', tags: [['shop', 'pet']], sinonimos: ['pet', 'petshop', 'pet shop', 'pet shops', 'animais'] },
  { valor: 'roupas', label: 'Lojas de roupas', tags: [['shop', 'clothes']], sinonimos: ['roupas', 'roupa', 'moda', 'boutique', 'vestuário'] },
  { valor: 'calcados', label: 'Lojas de calçados', tags: [['shop', 'shoes']], sinonimos: ['calçados', 'calcados', 'sapatos', 'sapataria'] },
  { valor: 'oficina', label: 'Oficinas mecânicas', tags: [['shop', 'car_repair']], sinonimos: ['oficina', 'oficinas', 'mecânica', 'mecanica', 'auto center'] },
  { valor: 'advogado', label: 'Advogados', tags: [['office', 'lawyer']], sinonimos: ['advogado', 'advogados', 'advocacia', 'escritório de advocacia', 'jurídico'] },
  { valor: 'contador', label: 'Contadores', tags: [['office', 'accountant']], sinonimos: ['contador', 'contadores', 'contabilidade', 'contábil'] },
  { valor: 'imobiliaria', label: 'Imobiliárias', tags: [['office', 'estate_agent']], sinonimos: ['imobiliaria', 'imobiliária', 'imóveis', 'imoveis', 'corretor'] },
  { valor: 'hotel', label: 'Hotéis / Pousadas', tags: [['tourism', 'hotel'], ['tourism', 'guest_house']], sinonimos: ['hotel', 'hotéis', 'pousada', 'pousadas', 'hospedagem'] },
  { valor: 'mercado', label: 'Mercados / Mercearias', tags: [['shop', 'supermarket'], ['shop', 'convenience']], sinonimos: ['mercado', 'mercados', 'mercearia', 'supermercado', 'minimercado'] },
]

export function tipoPorValor(valor) {
  return TIPOS_COMERCIO.find((t) => t.valor === valor)
}

/**
 * Geocodifica o nome de uma cidade para obter a bounding box (Brasil).
 * Retorna { nome, bbox: {south, north, west, east}, lat, lon }.
 */
export async function geocodarCidade(cidade) {
  const url = `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&q=${encodeURIComponent(
    cidade + ', Brasil'
  )}`
  const resp = await fetch(url, {
    headers: { 'Accept-Language': 'pt-BR' },
  })
  if (!resp.ok) throw new Error('Falha ao localizar a cidade.')
  const dados = await resp.json()
  if (!dados || dados.length === 0) {
    throw new Error(
      `Não encontrei a cidade "${cidade}". Confira a grafia — se ajudar, escreva com o estado (ex: "Campinas SP").`
    )
  }
  const c = dados[0]
  const [south, north, west, east] = c.boundingbox.map(Number)
  return {
    nome: c.display_name.split(',')[0],
    displayName: c.display_name,
    bbox: { south, north, west, east },
    lat: Number(c.lat),
    lon: Number(c.lon),
  }
}

function construirQuery(bbox, tags) {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
  const linhas = tags
    .flatMap(([k, v]) => [
      `  node["${k}"="${v}"](${b});`,
      `  way["${k}"="${v}"](${b});`,
    ])
    .join('\n')
  // O timeout aqui é o que o Overpass usa internamente. Ele precisa ser MENOR
  // que o TIMEOUT_POR_TENTATIVA do backend (api/overpass.js), senão nós
  // abortamos a conexão antes de o servidor conseguir responder — e aí perdemos
  // a mensagem de erro dele, que diria o motivo real.
  return `[out:json][timeout:18];\n(\n${linhas}\n);\nout center ${LIMITE_RESULTADOS};`
}

/**
 * Distância aproximada em metros entre dois pontos (boa o bastante para
 * decidir se dois registros são o mesmo estabelecimento).
 */
function distanciaMetros(aLat, aLon, bLat, bLon) {
  const mPorGrau = 111320
  const dLat = (aLat - bLat) * mPorGrau
  const dLon = (aLon - bLon) * mPorGrau * Math.cos((aLat * Math.PI) / 180)
  return Math.sqrt(dLat * dLat + dLon * dLon)
}

function pegarTelefone(tags) {
  // O OSM permite VÁRIOS números no mesmo campo, separados por ';'
  // (ex.: "+55 85 3181-9359;98969-3731"). Juntar tudo vira um número
  // inválido de 28 dígitos e o link do WhatsApp sai quebrado — por isso
  // separamos e escolhemos um só.
  const candidatos = [
    tags['contact:mobile'],
    tags['phone:mobile'],
    tags['contact:phone:mobile'],
    tags.phone,
    tags['contact:phone'],
  ]
    .filter(Boolean)
    .flatMap((v) => String(v).split(';'))
    .map((s) => s.trim())
    .filter(Boolean)

  // Nessas listas o DDD costuma aparecer só no primeiro número; os seguintes
  // vêm soltos ("...3181-9359;98969-3731"). Sem herdar o DDD, os celulares do
  // meio da lista seriam descartados por parecerem números curtos demais.
  const normalizados = []
  let ddd = ''
  for (const bruto of candidatos) {
    let n = apenasDigitos(bruto)
    if (n.startsWith('55') && n.length > 11) n = n.slice(2)
    if (n.length === 10 || n.length === 11) {
      ddd = n.slice(0, 2)
      normalizados.push(n)
    } else if ((n.length === 8 || n.length === 9) && ddd) {
      normalizados.push(ddd + n)
    }
  }

  // Celular ganha do fixo: é o único que recebe WhatsApp.
  return normalizados.find(ehCelular) || normalizados[0] || ''
}

function pegarSite(tags) {
  return tags.website || tags['contact:website'] || tags.url || ''
}

function montarEndereco(tags) {
  const partes = []
  const rua = tags['addr:street']
  const num = tags['addr:housenumber']
  if (rua) partes.push(num ? `${rua}, ${num}` : rua)
  const bairro = tags['addr:suburb'] || tags['addr:neighbourhood']
  if (bairro) partes.push(bairro)
  const cidade = tags['addr:city']
  if (cidade) partes.push(cidade)
  return partes.join(' · ')
}

/**
 * Consulta o Overpass através do nosso backend (mesma origem, sem CORS).
 * O backend é quem tenta os vários servidores do OpenStreetMap e descarta as
 * respostas inválidas — aqui só precisamos lidar com o resultado final.
 */
async function consultarOverpass(query) {
  let resp
  try {
    resp = await fetch(OVERPASS_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: query,
    })
  } catch (e) {
    console.error('Falha de rede ao chamar o proxy do Overpass:', e)
    throw new Error('Sem conexão com o servidor de busca. Verifique sua internet.')
  }

  if (!resp.ok) {
    // O backend manda { erro, detalhe } quando todos os servidores falharam.
    // `detalhe` é a lista do que cada servidor respondeu — é isso que diz o
    // motivo real da falha, então imprimimos um por linha.
    const corpo = await resp.json().catch(() => null)
    const detalhe = corpo && corpo.detalhe
    if (Array.isArray(detalhe)) {
      console.error('Falhas por servidor Overpass:')
      detalhe.forEach((d) => console.error('  -', d))
    } else if (detalhe) {
      console.error('Detalhe do backend:', detalhe)
    }
    throw new Error(
      (corpo && corpo.erro) ||
        'Os servidores de busca estão instáveis agora. Tente de novo em alguns segundos.'
    )
  }

  return resp.json()
}

/**
 * Busca comércios reais por tipo e cidade.
 * @param {{ tipo: string, cidade: string }} params
 * @returns {Promise<{ cidade: object, resultados: Array }>}
 */
export async function buscarComercios({ tipo, cidade }) {
  const cat = tipoPorValor(tipo)
  if (!cat) throw new Error('Tipo de comércio inválido.')

  const local = await geocodarCidade(cidade)
  const query = construirQuery(local.bbox, cat.tags)

  const dados = await consultarOverpass(query)
  const brutos = dados.elements || []
  const resultados = []

  for (const el of brutos) {
    const tags = el.tags || {}
    const nome = tags.name
    if (!nome) continue // ignora sem nome

    const telefoneRaw = pegarTelefone(tags)
    const site = pegarSite(tags)
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon

    // Deduplicação por nome + PROXIMIDADE.
    //
    // Não use o endereço como chave: unidades diferentes de uma rede muitas
    // vezes não têm `addr:street` no OSM, e aí duas lojas distintas colidem e
    // uma some. Em Fortaleza isso apagava uma Smart Fit a 9,7 km de outra.
    const jaTem = resultados.some((r) => {
      if (r.nome.toLowerCase() !== nome.toLowerCase()) return false
      // Sem coordenada em algum dos dois não dá para comparar: mantemos ambos,
      // porque exibir repetido é menos grave do que sumir com um lead.
      if (lat == null || lon == null || r.lat == null || r.lon == null) return false
      return distanciaMetros(lat, lon, r.lat, r.lon) < RAIO_MESMO_LOCAL_M
    })
    if (jaTem) continue

    resultados.push({
      osmId: `${el.type}/${el.id}`,
      nome,
      tipoLabel: cat.label,
      tipoValor: cat.valor,
      endereco: montarEndereco(tags),
      telefoneRaw,
      telefone: apenasDigitos(telefoneRaw),
      site,
      temSite: Boolean(site),
      temCelular: ehCelular(telefoneRaw),
      lat,
      lon,
      cidade: local.nome,
    })
  }

  // ordena: com celular primeiro (é quem dá para abordar), depois sem site
  resultados.sort((a, b) => {
    if (a.temCelular !== b.temCelular) return a.temCelular ? -1 : 1
    if (a.temSite !== b.temSite) return a.temSite ? 1 : -1
    return a.nome.localeCompare(b.nome)
  })

  // O Overpass corta a lista em silêncio ao bater o teto; sem este aviso o
  // usuário acha que viu a cidade inteira quando viu só uma parte.
  const truncado = brutos.length >= LIMITE_RESULTADOS

  return { cidade: local, resultados, truncado }
}
