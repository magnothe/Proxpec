# Prospecta — CRM de Prospecção de Clientes

Aplicação web para prospecção de clientes do seu negócio de **criação de sites**. Cadastre leads, gerencie o funil de vendas e dispare mensagens personalizadas pelo WhatsApp com um clique (via `wa.me`).

Feito com **React + Vite + Tailwind CSS**. Todos os dados ficam salvos **localmente no navegador** (localStorage) — nada vai para servidor nenhum.

## Como rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. Para gerar a versão de produção: `npm run build` e depois `npm run preview`.

## Fluxo principal

**Cadastrar lead → escolher template → disparar no WhatsApp.**

1. Em **Leads**, clique em *Novo lead* (ou *Importar CSV*).
2. Em **Templates**, ajuste as mensagens ou crie novas com as variáveis `{{nome}}`, `{{empresa}}`, `{{segmento}}`.
3. Em **Disparo**, filtre/selecione leads, escolha o template, confira a prévia e clique em *Abrir todos*. Cada conversa abre no WhatsApp já com a mensagem escrita, e o lead vira "contatado" automaticamente.

## Páginas

| Rota | O que faz |
|------|-----------|
| `/` | Dashboard: métricas, gráfico semanal por status e leads recentes |
| `/buscar` | **Busca real de comércios** por tipo + cidade (OpenStreetMap) + agente de IA |
| `/leads` | CRM: tabela com filtros, busca, CRUD, importação/exportação CSV |
| `/templates` | CRUD de mensagens com variáveis e prévia em tempo real |
| `/disparo` | Envio em lote via `wa.me` com intervalo configurável |
| `/config` | Dados do negócio, segmentos-alvo, intervalo de disparo e agente de IA |

## Buscar clientes (dados reais)

A página **Buscar** encontra comércios reais usando o **OpenStreetMap** (Nominatim + Overpass API) — gratuito, sem chave, direto do navegador.

- Filtre por **tipo de comércio** (restaurantes, clínicas, academias, salões, advogados, pet shops...) e **cidade**.
- Resultados trazem nome, endereço, telefone e site **quando cadastrados no mapa**.
- Filtro **"Só quem não tem site"** — seus melhores clientes em potencial.
- Selecione e clique em **Adicionar aos leads** para jogar tudo no seu CRM (telefone já formatado para WhatsApp).

### Agente de IA (opcional)

Em **Configurações → Agente de IA**, cole uma chave da API da Claude para habilitar:

- **Busca inteligente**: escreva em linguagem natural ("restaurantes em Campinas sem site") e a IA traduz em tipo + cidade + filtros.
- **Mensagens sob medida**: o botão "WhatsApp IA" gera um primeiro contato personalizado por negócio.

Sem chave, a busca por tipo + cidade funciona 100% e a interpretação cai num modo por palavras-chave.

> ⚠️ Como o app não tem servidor, a chave fica salva **só no seu navegador** e é usada em chamadas diretas à API. Use uma chave dedicada e configure limites de gasto no painel da Anthropic.

## Importação CSV

O arquivo deve ter um cabeçalho com as colunas (aceita `,` ou `;` como separador):

```csv
nome,telefone,empresa,segmento
Ana Paula,11987654321,Cantina da Ana,Restaurantes
```

## Observações

- **Pop-ups:** o "Abrir todos" usa `window.open` em sequência. Na primeira vez, o navegador pode bloquear — permita pop-ups para o site.
- **Telefone:** validação de padrão brasileiro (DDD + 8 ou 9 dígitos). O link é gerado como `https://wa.me/55DDDNUMERO?text=...`.
- **Backup:** como os dados vivem no localStorage deste navegador, use *Exportar CSV* periodicamente para não perder sua lista.

## Estrutura

```
src/
├── components/   # Sidebar, Layout, Modal, LeadModal, MetricCard, StatusBadge, ...
├── pages/        # Dashboard, Leads, Templates, Disparo, Config
├── hooks/        # useLocalStorage, useLeads, useTemplates, useConfig
├── utils/        # whatsapp.js, csv.js, format.js
└── data/         # defaults.js (status, templates padrão, seeds)
```

## Stack

React 18 · Vite 5 · Tailwind CSS 3 · React Router · Recharts · Framer Motion · react-hot-toast · lucide-react
