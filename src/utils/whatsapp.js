// Utilitários de WhatsApp, telefone e personalização de mensagens

/**
 * Remove tudo que não for dígito de um telefone.
 */
export function apenasDigitos(telefone = '') {
  return String(telefone).replace(/\D/g, '')
}

/**
 * Valida um telefone brasileiro: DDD (2 dígitos) + número (8 ou 9 dígitos).
 * Aceita com ou sem o 55 na frente. Retorna true/false.
 */
export function validarTelefone(telefone) {
  let num = apenasDigitos(telefone)
  // remove código do país se presente
  if (num.length > 11 && num.startsWith('55')) {
    num = num.slice(2)
  }
  // DDD + 9 dígitos (celular) = 11, ou DDD + 8 dígitos (fixo) = 10
  if (num.length !== 10 && num.length !== 11) return false
  const ddd = parseInt(num.slice(0, 2), 10)
  if (ddd < 11 || ddd > 99) return false
  // celular deve começar com 9 após o DDD
  if (num.length === 11 && num[2] !== '9') return false
  return true
}

/**
 * Diz se o número é um CELULAR brasileiro (DDD + 9 dígitos começando com 9).
 * Fixo não recebe WhatsApp, então é isso — e não `validarTelefone` — que
 * decide se dá para mandar mensagem.
 */
export function ehCelular(telefone) {
  let num = apenasDigitos(telefone)
  if (num.length > 11 && num.startsWith('55')) num = num.slice(2)
  if (num.length !== 11) return false
  const ddd = parseInt(num.slice(0, 2), 10)
  if (ddd < 11 || ddd > 99) return false
  return num[2] === '9'
}

/**
 * Formata um telefone para exibição: (11) 99999-9999
 */
export function formatarTelefone(telefone) {
  let num = apenasDigitos(telefone)
  if (num.length > 11 && num.startsWith('55')) num = num.slice(2)
  if (num.length === 11) {
    return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`
  }
  if (num.length === 10) {
    return `(${num.slice(0, 2)}) ${num.slice(2, 6)}-${num.slice(6)}`
  }
  return telefone
}

/**
 * Normaliza o telefone para o formato internacional usado no wa.me: 55DDDNUMERO
 */
export function normalizarParaWhatsApp(telefone) {
  let num = apenasDigitos(telefone)
  if (num.startsWith('55') && num.length > 11) return num
  return '55' + num
}

/**
 * Gera o link wa.me com a mensagem já codificada.
 * gerarLinkWhatsApp('11999998888', 'Olá!') =>
 * https://wa.me/5511999998888?text=Ol%C3%A1!
 */
export function gerarLinkWhatsApp(telefone, mensagem = '') {
  const numero = normalizarParaWhatsApp(telefone)
  const texto = encodeURIComponent(mensagem)
  return `https://wa.me/${numero}${texto ? `?text=${texto}` : ''}`
}

const LABEL_SEGMENTO = 'segmento'

export const TEMPLATE_PRIMEIRO_CONTATO = 'Primeiro Contato'

const semAcento = (s = '') =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

/**
 * Acha um template pelo nome (ignorando acentos e maiúsculas).
 * Se não existir um com esse nome — porque foi renomeado ou excluído —
 * cai para o primeiro da lista. Retorna null se não houver template nenhum.
 */
export function encontrarTemplate(templates = [], nome = TEMPLATE_PRIMEIRO_CONTATO) {
  const alvo = semAcento(nome)
  return templates.find((t) => semAcento(t.nome) === alvo) || templates[0] || null
}

/**
 * Substitui as variáveis {{nome}}, {{empresa}}, {{segmento}} pelos dados do lead.
 * Variáveis não encontradas são substituídas por string vazia (com trim de espaços duplos).
 */
export function personalizarMensagem(template = '', lead = {}) {
  if (!template) return ''
  const mapa = {
    nome: lead.nome || '',
    empresa: lead.empresa || '',
    [LABEL_SEGMENTO]: lead.segmento || '',
  }
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (match, chave) => {
      const k = chave.toLowerCase()
      return k in mapa ? mapa[k] : match
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
