// Descobre se um lead já tem site.
//
// Leads novos guardam o campo `site` (vem do OpenStreetMap na tela de Buscar).
// Os leads antigos, cadastrados antes desse campo existir, só têm a marca
// dentro de `notas` ("Site: x" ou "Sem site") — por isso o fallback de texto.

const RE_TEM_SITE = /(^|\n)\s*site:\s*\S/i
const RE_SEM_SITE = /(^|\n)\s*sem site\s*(\n|$)/i

/**
 * Retorna true (tem site), false (não tem) ou null (não dá para saber).
 */
export function situacaoSite(lead = {}) {
  if (lead.site && String(lead.site).trim()) return true
  const notas = lead.notas || ''
  if (RE_TEM_SITE.test(notas)) return true
  if (RE_SEM_SITE.test(notas)) return false
  return null
}

/**
 * Alvo do disparo de "quem não tem site": quem sabidamente não tem, mais
 * quem nunca teve essa informação preenchida. Só fica de fora quem tem site
 * comprovado — que é justamente quem não interessa para essa oferta.
 */
export function semSiteConfirmadoOuDesconhecido(lead) {
  return situacaoSite(lead) !== true
}
