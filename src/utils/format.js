// Helpers de formatação de datas e ids

export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function agora() {
  return new Date().toISOString()
}

export function formatarData(iso, comHora = false) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  const opcoes = comHora
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' }
  return d.toLocaleDateString('pt-BR', opcoes)
}

export function tempoRelativo(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `há ${horas}h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  return formatarData(iso)
}

export function ehHoje(iso) {
  if (!iso) return false
  const d = new Date(iso)
  const h = new Date()
  return (
    d.getDate() === h.getDate() &&
    d.getMonth() === h.getMonth() &&
    d.getFullYear() === h.getFullYear()
  )
}
