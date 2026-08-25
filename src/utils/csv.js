// Importação e exportação de CSV (sem dependências externas)

/**
 * Faz parse de um CSV simples com suporte a aspas e vírgulas dentro de campos.
 * Retorna array de objetos usando a primeira linha como cabeçalho.
 * Aceita separador , ou ;
 */
export function parseCSV(texto) {
  const linhas = dividirLinhas(texto.trim())
  if (linhas.length === 0) return []

  const separador = detectarSeparador(linhas[0])
  const cabecalho = parseLinha(linhas[0], separador).map((h) =>
    h.trim().toLowerCase()
  )

  const registros = []
  for (let i = 1; i < linhas.length; i++) {
    if (!linhas[i].trim()) continue
    const campos = parseLinha(linhas[i], separador)
    const obj = {}
    cabecalho.forEach((chave, idx) => {
      obj[chave] = (campos[idx] ?? '').trim()
    })
    registros.push(obj)
  }
  return registros
}

function detectarSeparador(linha) {
  const virgulas = (linha.match(/,/g) || []).length
  const pontoVirgula = (linha.match(/;/g) || []).length
  return pontoVirgula > virgulas ? ';' : ','
}

function dividirLinhas(texto) {
  // divide por \n mas respeita quebras dentro de aspas
  const linhas = []
  let atual = ''
  let dentroAspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (c === '"') dentroAspas = !dentroAspas
    if ((c === '\n' || c === '\r') && !dentroAspas) {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linhas.push(atual)
      atual = ''
    } else {
      atual += c
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

function parseLinha(linha, sep) {
  const campos = []
  let atual = ''
  let dentroAspas = false
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') {
      if (dentroAspas && linha[i + 1] === '"') {
        atual += '"'
        i++
      } else {
        dentroAspas = !dentroAspas
      }
    } else if (c === sep && !dentroAspas) {
      campos.push(atual)
      atual = ''
    } else {
      atual += c
    }
  }
  campos.push(atual)
  return campos
}

/**
 * Converte um array de objetos em texto CSV.
 * colunas: array de { chave, titulo }
 */
export function gerarCSV(dados, colunas) {
  const cabecalho = colunas.map((c) => escaparCampo(c.titulo)).join(',')
  const linhas = dados.map((item) =>
    colunas.map((c) => escaparCampo(item[c.chave] ?? '')).join(',')
  )
  return [cabecalho, ...linhas].join('\n')
}

function escaparCampo(valor) {
  const str = String(valor)
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Dispara o download de um arquivo CSV no navegador.
 */
export function baixarCSV(nomeArquivo, conteudo) {
  const bom = '﻿' // para acentos abrirem certo no Excel
  const blob = new Blob([bom + conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
