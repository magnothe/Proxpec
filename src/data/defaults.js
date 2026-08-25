// Dados padrão: status, templates pré-cadastrados, configuração inicial e seeds
import { uuid, agora } from '../utils/format'

export const STATUS = {
  novo: { valor: 'novo', label: 'Novo', cor: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  contatado: { valor: 'contatado', label: 'Contatado', cor: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  em_negociacao: { valor: 'em_negociacao', label: 'Em negociação', cor: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  fechado: { valor: 'fechado', label: 'Fechado', cor: '#25D366', bg: 'rgba(37,211,102,0.14)' },
  perdido: { valor: 'perdido', label: 'Perdido', cor: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

export const STATUS_LISTA = Object.values(STATUS)

export const CONFIG_PADRAO = {
  nomeEmpresa: 'Magno — Criação de Sites',
  telefone: '',
  segmentos: ['Restaurantes', 'Clínicas', 'Academias', 'Lojas', 'Advogados', 'Salões de beleza'],
  intervaloDisparo: 2,
  iaApiKey: '',
  iaModelo: 'claude-haiku-4-5-20251001',
}

export function criarTemplatesPadrao() {
  const base = [
    {
      nome: 'Primeiro Contato',
      mensagem:
        'Olá, {{nome}}! Tudo bem? Me chamo [magno] e trabalho com criação de sites profissionais. Vi que a {{empresa}} tem muito potencial e gostaria de mostrar como um site pode trazer mais clientes para vocês. Posso te mostrar alguns exemplos? 🚀',
    },
    {
      nome: 'Follow-up',
      mensagem:
        'Oi, {{nome}}! Passando aqui para saber se conseguiu dar uma olhada na proposta que enviei para a {{empresa}}. Fico à disposição para tirar qualquer dúvida! 😊',
    },
    {
      nome: 'Proposta Comercial',
      mensagem:
        '{{nome}}, preparei uma proposta especial para a {{empresa}}! Um site profissional com design moderno, otimizado para Google e celular. Posso te enviar os detalhes? 📋',
    },
    {
      nome: 'Pós-venda',
      mensagem:
        'Oi, {{nome}}! Como está o site da {{empresa}}? Queria saber se está tudo funcionando bem e se precisa de algum ajuste. Estou sempre à disposição! 👊',
    },
  ]
  return base.map((t) => ({ id: uuid(), ...t, criadoEm: agora() }))
}

export function criarLeadsExemplo() {
  const seg = ['Restaurantes', 'Clínicas', 'Academias', 'Lojas']
  const amostra = [
    { nome: 'Ana Paula', empresa: 'Cantina da Ana', telefone: '11987654321', segmento: 'Restaurantes', status: 'novo' },
    { nome: 'Carlos Mendes', empresa: 'Clínica Vida+', telefone: '11991234567', segmento: 'Clínicas', status: 'contatado' },
    { nome: 'Juliana Rocha', empresa: 'Studio Fit', telefone: '21998877665', segmento: 'Academias', status: 'em_negociacao' },
    { nome: 'Roberto Alves', empresa: 'Loja do Bento', telefone: '31987651234', segmento: 'Lojas', status: 'novo' },
    { nome: 'Marina Costa', empresa: 'Boteco da Marina', telefone: '11996543210', segmento: 'Restaurantes', status: 'fechado' },
  ]
  const t = agora()
  return amostra.map((l, i) => ({
    id: uuid(),
    ...l,
    notas: '',
    criadoEm: t,
    atualizadoEm: t,
    historico: [{ data: t, acao: 'Lead cadastrado' }],
  }))
}
