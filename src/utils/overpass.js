// Busca real de comércios via OpenStreetMap (Nominatim + Overpass API).
// Gratuito, sem chave, funciona direto do navegador (CORS liberado).
import { apenasDigitos } from './whatsapp'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OVERPASS = 'https://overpass-api.de/api/interpreter'

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
    throw new Error(`Cidade "${cidade}" não encontrada.`)
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
  return `[out:json][timeout:40];\n(\n${linhas}\n);\nout center 150;`
}

function pegarTelefone(tags) {
  return (
    tags.phone ||
    tags['contact:phone'] ||
    tags['contact:mobile'] ||
    tags['contact:phone:mobile'] ||
    tags['phone:mobile'] ||
    ''
  )
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
 * Busca comércios reais por tipo e cidade.
 * @param {{ tipo: string, cidade: string }} params
 * @returns {Promise<{ cidade: object, resultados: Array }>}
 */
export async function buscarComercios({ tipo, cidade }) {
  const cat = tipoPorValor(tipo)
  if (!cat) throw new Error('Tipo de comércio inválido.')

  const local = await geocodarCidade(cidade)
  const query = construirQuery(local.bbox, cat.tags)

  const resp = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: query,
  })
  if (resp.status === 429 || resp.status === 504) {
    throw new Error('O servidor de busca está sobrecarregado. Tente novamente em alguns segundos.')
  }
  if (!resp.ok) throw new Error('Falha na busca de comércios.')

  const dados = await resp.json()
  const vistos = new Set()
  const resultados = []

  for (const el of dados.elements || []) {
    const tags = el.tags || {}
    const nome = tags.name
    if (!nome) continue // ignora sem nome
    const chave = `${nome.toLowerCase()}|${tags['addr:street'] || ''}`
    if (vistos.has(chave)) continue
    vistos.add(chave)

    const telefoneRaw = pegarTelefone(tags)
    const site = pegarSite(tags)
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon

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
      lat,
      lon,
      cidade: local.nome,
    })
  }

  // ordena: sem site primeiro (melhores oportunidades), depois com telefone
  resultados.sort((a, b) => {
    if (a.temSite !== b.temSite) return a.temSite ? 1 : -1
    if (Boolean(a.telefone) !== Boolean(b.telefone)) return a.telefone ? -1 : 1
    return a.nome.localeCompare(b.nome)
  })

  return { cidade: local, resultados }
}
