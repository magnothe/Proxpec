// Retenção de leads: limpeza automática dos antigos para liberar espaço.
//
// Regra escolhida: apaga tudo que estiver parado há mais de DIAS_RETENCAO,
// EXCETO os fechados — venda ganha é histórico e nunca some.
//
// Ao apagar, guardamos só o telefone numa lista de "já abordados". Assim o
// cliente não reaborda alguém que já recebeu mensagem, mesmo depois do lead
// completo ter sido removido. Custa ~13 bytes contra ~729 do lead inteiro.

export const DIAS_RETENCAO = 90

// Status que a limpeza nunca toca.
const STATUS_PRESERVADOS = ['fechado']

// Status cujo telefone vira "já abordado" ao serem apagados (o cliente já
// falou com essa pessoa). Um lead 'novo' apagado não deixa rastro: ninguém
// falou com ele, então pode reaparecer numa busca futura normalmente.
const STATUS_JA_ABORDADOS = ['contatado', 'em_negociacao', 'perdido']

const diasDesde = (iso, referencia) => {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0 // data ilegível: trata como recente, nunca apaga
  return (referencia - t) / 86400000
}

/**
 * Diz se um lead passou do prazo e pode ser apagado.
 */
export function expirou(lead, referencia = Date.now(), dias = DIAS_RETENCAO) {
  if (STATUS_PRESERVADOS.includes(lead.status)) return false
  // `atualizadoEm` é o que importa: mexer no lead renova o prazo dele.
  const marco = lead.atualizadoEm || lead.criadoEm
  if (!marco) return false // sem data nenhuma, não arrisca
  return diasDesde(marco, referencia) > dias
}

/**
 * Separa os leads entre os que ficam e os que expiraram.
 * Não altera nada — quem decide aplicar é quem chama.
 */
export function planejarLimpeza(leads = [], referencia = Date.now(), dias = DIAS_RETENCAO) {
  const manter = []
  const expirados = []
  for (const lead of leads) {
    if (expirou(lead, referencia, dias)) expirados.push(lead)
    else manter.push(lead)
  }
  return { manter, expirados }
}

/**
 * Aplica a limpeza a um estado completo do app, devolvendo o novo estado e
 * quantos leads saíram. Devolve o MESMO objeto se nada expirou, para não
 * disparar sincronização à toa.
 */
export function limparAntigos(estado, referencia = Date.now(), dias = DIAS_RETENCAO) {
  const leads = estado?.leads || []
  const { manter, expirados } = planejarLimpeza(leads, referencia, dias)
  if (expirados.length === 0) return { estado, removidos: 0 }

  const jaAbordados = new Set(estado.jaAbordados || [])
  for (const lead of expirados) {
    if (lead.telefone && STATUS_JA_ABORDADOS.includes(lead.status)) {
      jaAbordados.add(lead.telefone)
    }
  }

  return {
    estado: { ...estado, leads: manter, jaAbordados: Array.from(jaAbordados) },
    removidos: expirados.length,
  }
}

/**
 * Quantos dias faltam até um lead expirar (negativo = já passou).
 * Usado para avisar o usuário antes de a limpeza acontecer.
 */
export function diasAteExpirar(lead, referencia = Date.now(), dias = DIAS_RETENCAO) {
  if (STATUS_PRESERVADOS.includes(lead.status)) return Infinity
  const marco = lead.atualizadoEm || lead.criadoEm
  if (!marco) return Infinity
  return Math.ceil(dias - diasDesde(marco, referencia))
}
