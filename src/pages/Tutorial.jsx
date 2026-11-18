import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Radar,
  Users,
  MessageSquareText,
  Send,
  Settings,
  ArrowRight,
  Lightbulb,
  Sparkles,
  ShieldAlert,
  Cloud,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'

// Fluxo resumido mostrado no topo: do lead encontrado até a conversa aberta.
const FLUXO = [
  { titulo: 'Encontre', texto: 'Busque comércios reais ou cadastre leads.', icone: Radar },
  { titulo: 'Escreva', texto: 'Monte mensagens com variáveis nos templates.', icone: MessageSquareText },
  { titulo: 'Dispare', texto: 'Abra as conversas no WhatsApp com a mensagem pronta.', icone: Send },
  { titulo: 'Acompanhe', texto: 'Mova os leads pelo funil até fechar.', icone: LayoutDashboard },
]

const SECOES = [
  {
    to: '/config',
    titulo: 'Configurações',
    icone: Settings,
    resumo: 'Comece por aqui: dados do seu negócio e preferências.',
    passos: [
      'Preencha o nome do profissional/empresa e seu telefone de contato.',
      'Defina o intervalo entre aberturas do disparo (recomendado: 2 segundos).',
      'Cadastre os segmentos-alvo (ex: Restaurantes, Pet shops) — eles viram sugestão ao criar leads e filtro no disparo.',
      'Opcional: cole uma chave da API da Claude em "Agente de IA" e clique em "Testar conexão".',
    ],
  },
  {
    to: '/buscar',
    titulo: 'Buscar',
    icone: Radar,
    resumo: 'Encontre comércios reais por tipo e cidade (dados do OpenStreetMap).',
    passos: [
      'Escolha o tipo de comércio, digite a cidade e clique em "Buscar".',
      'Com a IA ativa, você pode escrever o pedido em linguagem natural, como "restaurantes em Campinas sem site", e clicar em "Buscar com IA".',
      'Use os filtros "Só com celular", "Esconder quem já é lead" e "Só quem não tem site" para achar os melhores clientes em potencial.',
      'Marque os resultados e clique em "Adicionar aos leads". O telefone já entra formatado para o WhatsApp.',
      'O botão "WhatsApp" de cada resultado abre a conversa direto — com IA, a mensagem é adaptada para aquele negócio.',
    ],
  },
  {
    to: '/leads',
    titulo: 'Leads',
    icone: Users,
    resumo: 'Seu CRM: todos os contatos e em que etapa cada um está.',
    passos: [
      'Clique em "Novo lead" para cadastrar manualmente, ou em "Importar CSV" para trazer uma lista.',
      'Use a busca e os filtros por status e segmento para encontrar contatos.',
      'Edite um lead para mudar o status: Novo → Contatado → Em negociação → Fechado (ou Perdido).',
      'Use "Exportar CSV" de vez em quando para ter um backup da sua lista.',
    ],
    dica: 'O CSV precisa de cabeçalho com as colunas nome, telefone, empresa, segmento (separadas por vírgula ou ponto e vírgula).',
  },
  {
    to: '/templates',
    titulo: 'Templates',
    icone: MessageSquareText,
    resumo: 'Mensagens prontas que se personalizam sozinhas para cada lead.',
    passos: [
      'Clique em "Novo template", dê um nome e escreva a mensagem.',
      'Insira as variáveis {{nome}}, {{empresa}} e {{segmento}} — elas são trocadas pelos dados de cada lead na hora do envio.',
      'Confira a prévia em tempo real antes de salvar.',
    ],
  },
  {
    to: '/disparo',
    titulo: 'Disparo',
    icone: Send,
    resumo: 'Abra várias conversas no WhatsApp de uma vez, com a mensagem já escrita.',
    passos: [
      'Filtre por status, nicho e situação do site (por padrão, só quem não tem site).',
      'Escolha o template e confira a prévia da mensagem em cada lead.',
      'Selecione os leads e clique em "Enviar para N selecionado(s)". Para um só, use "Abrir WhatsApp".',
      'Cada conversa abre no WhatsApp com o texto pronto — você só aperta enviar. O lead vira "Contatado" automaticamente.',
    ],
    dica: 'Na primeira vez o navegador pode bloquear os pop-ups. Permita pop-ups para este site; se continuar bloqueado, aparece uma fila no rodapé com "Abrir e avançar" e "Pular".',
  },
  {
    to: '/',
    titulo: 'Dashboard',
    icone: LayoutDashboard,
    resumo: 'Visão geral dos seus resultados.',
    passos: [
      'Veja o total de leads, novos do dia, mensagens enviadas e a taxa de conversão (leads fechados ÷ total).',
      'O gráfico "Leads na semana" mostra os cadastros dos últimos 7 dias por status.',
      '"Por status" mostra como seu funil está distribuído; "Leads recentes" dá acesso rápido aos últimos contatos.',
    ],
  },
]

function Secao({ numero, to, titulo, icone: Icone, resumo, passos, dica }) {
  return (
    <section className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-whatsapp/12 text-whatsapp">
            <Icone size={20} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-content-500">Passo {numero}</p>
            <h2 className="font-display text-lg font-semibold text-content-100">{titulo}</h2>
            <p className="text-sm text-content-400">{resumo}</p>
          </div>
        </div>
        <Link to={to} className="btn-ghost shrink-0 self-start text-sm">
          Abrir {titulo} <ArrowRight size={15} />
        </Link>
      </div>

      <ol className="mt-4 space-y-2.5">
        {passos.map((p, i) => (
          <li key={i} className="flex gap-3 text-sm text-content-300">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-700 text-[11px] font-semibold text-content-200">
              {i + 1}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ol>

      {dica && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-800 px-3 py-2.5 text-xs text-content-400">
          <Lightbulb size={15} className="mt-0.5 shrink-0 text-whatsapp" />
          <span>{dica}</span>
        </div>
      )}
    </section>
  )
}

export default function Tutorial() {
  return (
    <div>
      <PageHeader
        titulo="Como funciona"
        subtitulo="Um guia rápido do Prospecta: do primeiro lead até o cliente fechado."
      />

      {/* Fluxo resumido */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FLUXO.map(({ titulo, texto, icone: Icone }, i) => (
          <div key={titulo} className="card flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-whatsapp text-onAccent">
              <Icone size={18} />
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-content-100">
                {i + 1}. {titulo}
              </p>
              <p className="text-xs text-content-400">{texto}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {SECOES.map((s, i) => (
          <Secao key={s.to} numero={i + 1} {...s} />
        ))}
      </div>

      {/* Avisos gerais */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-content-100">
            <Cloud size={17} className="text-whatsapp" /> Onde ficam seus dados
          </h3>
          <p className="mt-2 text-sm text-content-400">
            Com login, tudo é sincronizado na nuvem e só você vê seus leads. Sem login (modo
            local), os dados ficam apenas neste navegador — exporte o CSV para não perdê-los.
          </p>
        </div>
        <div className="card p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-content-100">
            <Sparkles size={17} className="text-whatsapp" /> IA é opcional
          </h3>
          <p className="mt-2 text-sm text-content-400">
            Sem chave de IA, a busca por tipo + cidade e os templates funcionam normalmente. A IA
            só deixa a busca mais esperta e as mensagens mais personalizadas.
          </p>
        </div>
        <div className="card p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-content-100">
            <ShieldAlert size={17} className="text-amber-400" /> Envie com moderação
          </h3>
          <p className="mt-2 text-sm text-content-400">
            Muitas mensagens iguais em pouco tempo podem fazer o WhatsApp restringir seu número.
            Mantenha um intervalo entre aberturas e personalize os templates.
          </p>
        </div>
      </div>
    </div>
  )
}
