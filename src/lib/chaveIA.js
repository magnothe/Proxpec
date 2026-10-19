// A chave da API da Claude mora SÓ no navegador de quem a digitou.
//
// Antes ela viajava junto com o resto da configuração para o Supabase, dentro
// do JSONB de `app_data`, em texto puro. Chave de API não é preferência de
// usuário, é credencial: sincronizar isso significa guardar a credencial de
// um terceiro num banco que não precisa dela para nada — e a tabela nova
// (`user_config`) por isso nem tem coluna onde pô-la.
//
// O custo dessa escolha é real e vale dizer em voz alta: a chave não segue o
// usuário entre navegadores. Quem usar o app no celular e no desktop vai
// digitá-la duas vezes.

const CHAVE = 'prospecta:iaApiKey'

export function lerChaveIA() {
  try {
    return localStorage.getItem(CHAVE) || ''
  } catch {
    // Aba anônima ou storage bloqueado: sem chave, o app cai no
    // interpretador por palavras-chave e a busca continua funcionando.
    return ''
  }
}

export function gravarChaveIA(valor) {
  try {
    const v = (valor || '').trim()
    if (v) localStorage.setItem(CHAVE, v)
    else localStorage.removeItem(CHAVE)
  } catch {
    // Não dá para persistir: a chave vale só para esta sessão.
  }
}
