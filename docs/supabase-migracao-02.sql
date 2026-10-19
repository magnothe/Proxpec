-- Prospecta — migração 02: do JSONB para tabelas
--
-- Rode no SQL Editor DEPOIS de `supabase-setup.sql` e `supabase-migracao-01.sql`.
-- Pode rodar mais de uma vez sem duplicar nada.
--
-- POR QUE: até aqui tudo vivia em `app_data.dados`, um único JSONB por
-- usuário. Isso custava caro de três formas:
--   - cada alteração reescrevia o objeto inteiro (todos os leads, todos os
--     templates) só para mudar um status;
--   - duas abas abertas se sobrescreviam em silêncio, porque o upsert não
--     tinha como saber que a outra havia gravado antes;
--   - nada era filtrável no banco: paginar ou buscar exigia trazer tudo.
--
-- A tabela `app_data` NÃO é apagada por esta migração. Ela fica como rede de
-- segurança até você confirmar que o app está lendo das tabelas novas. No fim
-- do arquivo está o comando para removê-la quando quiser.

-- =====================================================================
-- 1) TABELAS
-- =====================================================================

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null default '',
  empresa text not null default '',
  telefone text not null default '',
  segmento text not null default '',
  status text not null default 'novo',
  site text not null default '',
  notas text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint leads_status_valido
    check (status in ('novo', 'contatado', 'em_negociacao', 'fechado', 'perdido'))
);

-- O histórico sai de dentro do lead e vira tabela própria. Hoje o app só o
-- usa para contar mensagens enviadas, mas como linha ele também serve para
-- montar uma timeline depois, sem reescrever o lead a cada evento.
--
-- `user_id` aparece aqui mesmo dando para chegar nele via `lead_id`: sem essa
-- coluna, a política de RLS precisaria de um subselect em `leads` a cada
-- linha lida, o que é mais caro e mais fácil de errar.
create table if not exists public.lead_historico (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data timestamptz not null default now(),
  acao text not null,
  template text,
  mensagem text
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null default 'Sem titulo',
  mensagem text not null default '',
  criado_em timestamptz not null default now()
);

-- Uma linha por usuário. Repare que NÃO existe coluna para a chave da API da
-- Claude: ela era gravada em texto puro no JSONB e agora fica só no navegador
-- de quem a digitou. Chave de API não é dado de configuração, é credencial —
-- e credencial de terceiro não tem por que trafegar para o nosso banco.
create table if not exists public.user_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome_empresa text not null default '',
  telefone text not null default '',
  segmentos text[] not null default '{}',
  intervalo_disparo int not null default 2,
  ia_modelo text not null default 'claude-haiku-4-5-20251001',
  atualizado_em timestamptz not null default now()
);

-- Telefones de leads já apagados pela retenção, para não reabordar quem já
-- recebeu mensagem. Era um array que crescia para sempre dentro do JSONB e
-- era reenviado inteiro a cada gravação; como tabela, cada telefone é uma
-- linha e a chave composta já garante que não repete.
create table if not exists public.ja_abordados (
  user_id uuid not null references auth.users(id) on delete cascade,
  telefone text not null,
  marcado_em timestamptz not null default now(),
  primary key (user_id, telefone)
);

-- =====================================================================
-- 2) ÍNDICES
-- =====================================================================
-- Toda consulta do app começa filtrando por `user_id` (a RLS obriga), então
-- todo índice é composto começando por ele. Um índice só em `status` nunca
-- seria escolhido pelo planejador.

-- A lista de leads é ordenada do mais recente para o mais antigo.
create index if not exists leads_user_atualizado_idx
  on public.leads (user_id, atualizado_em desc);

-- Filtro por status nas telas de Leads e Disparo.
create index if not exists leads_user_status_idx
  on public.leads (user_id, status);

-- A tela de Buscar confere, a cada resultado, se o telefone já virou lead.
create index if not exists leads_user_telefone_idx
  on public.leads (user_id, telefone);

create index if not exists lead_historico_lead_idx
  on public.lead_historico (lead_id);

create index if not exists lead_historico_user_idx
  on public.lead_historico (user_id);

create index if not exists templates_user_idx
  on public.templates (user_id, criado_em);

-- =====================================================================
-- 3) RLS
-- =====================================================================
-- Mesma regra do `app_data`: cada um só enxerga o que é seu. Sem isto, as
-- tabelas novas ficariam abertas para qualquer um com a chave publicável,
-- que está visível no JavaScript do site.
--
-- O `(select auth.uid())` entre parênteses é proposital: assim o Postgres
-- avalia a função uma vez por consulta, e não uma vez por linha.

alter table public.leads          enable row level security;
alter table public.lead_historico enable row level security;
alter table public.templates      enable row level security;
alter table public.user_config    enable row level security;
alter table public.ja_abordados   enable row level security;

do $policies$
declare
  t text;
begin
  foreach t in array array['leads', 'lead_historico', 'templates', 'user_config', 'ja_abordados']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select using ((select auth.uid()) = user_id)',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert with check ((select auth.uid()) = user_id)',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete using ((select auth.uid()) = user_id)',
      t || '_delete', t);
  end loop;
end;
$policies$;

-- =====================================================================
-- 4) `atualizado_em` carimbado pelo servidor
-- =====================================================================
-- Mesmo motivo da migração 01: relógio de cliente erra, e o valor que o
-- navegador manda é descartado pelo gatilho.
drop trigger if exists leads_atualizado_em on public.leads;
create trigger leads_atualizado_em
  before insert or update on public.leads
  for each row execute function private.toca_atualizado_em();

drop trigger if exists user_config_atualizado_em on public.user_config;
create trigger user_config_atualizado_em
  before insert or update on public.user_config
  for each row execute function private.toca_atualizado_em();

-- =====================================================================
-- 5) MIGRAÇÃO DOS DADOS QUE JÁ EXISTEM
-- =====================================================================
-- Lê cada linha de `app_data` e explode o JSONB nas tabelas novas.
--
-- É idempotente por construção: todo insert termina em `on conflict do
-- nothing`, e os ids vêm do próprio JSON (o app já gerava UUID no cliente).
-- Rodar de novo não duplica nem sobrescreve o que você fez depois.
--
-- Datas: no JSON são texto ISO-8601. O cast para timestamptz pode estourar
-- num registro corrompido, então cada uma passa por uma função que devolve
-- NULL em vez de derrubar a migração inteira por causa de uma linha torta.
-- Três conversores "que não explodem". Um cast direto (`txt::timestamptz`)
-- aborta o bloco inteiro ao encontrar lixo, e aí UM registro torto impede a
-- migração de TODOS os outros. Estes devolvem NULL e deixam o `coalesce` de
-- quem chama decidir o valor padrão.
create or replace function private.iso_para_timestamp(txt text)
returns timestamptz
language plpgsql
immutable
as $fn$
begin
  return txt::timestamptz;
exception when others then
  return null;
end;
$fn$;

create or replace function private.texto_para_uuid(txt text)
returns uuid
language plpgsql
immutable
as $fn$
begin
  return txt::uuid;
exception when others then
  return null;
end;
$fn$;

create or replace function private.texto_para_int(txt text)
returns int
language plpgsql
immutable
as $fn$
begin
  return txt::int;
exception when others then
  return null;
end;
$fn$;

do $migracao$
declare
  r record;
  l jsonb;
  h jsonb;
  t jsonb;
  cfg jsonb;
  v_lead_id uuid;   -- nome com prefixo: `lead_id` colidiria com a coluna
                    -- de mesmo nome e o plpgsql aborta por ambiguidade
begin
  for r in select user_id, dados from public.app_data loop

    -- ---- leads + histórico ----
    if jsonb_typeof(r.dados->'leads') = 'array' then
      for l in select * from jsonb_array_elements(r.dados->'leads') loop

        v_lead_id := coalesce(private.texto_para_uuid(l->>'id'), gen_random_uuid());

        insert into public.leads (
          id, user_id, nome, empresa, telefone, segmento,
          status, site, notas, criado_em, atualizado_em
        )
        values (
          v_lead_id,
          r.user_id,
          coalesce(l->>'nome', ''),
          coalesce(l->>'empresa', ''),
          coalesce(l->>'telefone', ''),
          coalesce(l->>'segmento', ''),
          -- status desconhecido vira 'novo', para não bater na constraint e
          -- abortar a migração de todo o resto
          case when l->>'status' in ('novo','contatado','em_negociacao','fechado','perdido')
               then l->>'status' else 'novo' end,
          coalesce(l->>'site', ''),
          coalesce(l->>'notas', ''),
          coalesce(private.iso_para_timestamp(l->>'criadoEm'), now()),
          coalesce(private.iso_para_timestamp(l->>'atualizadoEm'),
                   private.iso_para_timestamp(l->>'criadoEm'), now())
        )
        on conflict (id) do nothing;

        if jsonb_typeof(l->'historico') = 'array' then
          for h in select * from jsonb_array_elements(l->'historico') loop
            insert into public.lead_historico (lead_id, user_id, data, acao, template, mensagem)
            select
              v_lead_id,
              r.user_id,
              coalesce(private.iso_para_timestamp(h->>'data'), now()),
              coalesce(h->>'acao', 'Evento'),
              h->>'template',
              h->>'mensagem'
            -- o histórico não tem id próprio no JSON, então a proteção contra
            -- duplicar numa segunda execução é conferir se o evento já está lá
            where not exists (
              select 1 from public.lead_historico x
              where x.lead_id = v_lead_id
                and x.acao = coalesce(h->>'acao', 'Evento')
                and x.data = coalesce(private.iso_para_timestamp(h->>'data'), now())
            );
          end loop;
        end if;

      end loop;
    end if;

    -- ---- templates ----
    if jsonb_typeof(r.dados->'templates') = 'array' then
      for t in select * from jsonb_array_elements(r.dados->'templates') loop
        insert into public.templates (id, user_id, nome, mensagem, criado_em)
        values (
          coalesce(private.texto_para_uuid(t->>'id'), gen_random_uuid()),
          r.user_id,
          coalesce(nullif(t->>'nome', ''), 'Sem titulo'),
          coalesce(t->>'mensagem', ''),
          coalesce(private.iso_para_timestamp(t->>'criadoEm'), now())
        )
        on conflict (id) do nothing;
      end loop;
    end if;

    -- ---- config (sem a chave da API, de propósito) ----
    cfg := coalesce(r.dados->'config', '{}'::jsonb);
    insert into public.user_config (
      user_id, nome_empresa, telefone, segmentos, intervalo_disparo, ia_modelo
    )
    values (
      r.user_id,
      coalesce(cfg->>'nomeEmpresa', ''),
      coalesce(cfg->>'telefone', ''),
      case when jsonb_typeof(cfg->'segmentos') = 'array'
           then array(select jsonb_array_elements_text(cfg->'segmentos'))
           else '{}'::text[] end,
      coalesce(private.texto_para_int(cfg->>'intervaloDisparo'), 2),
      coalesce(nullif(cfg->>'iaModelo', ''), 'claude-haiku-4-5-20251001')
    )
    on conflict (user_id) do nothing;

    -- ---- já abordados ----
    if jsonb_typeof(r.dados->'jaAbordados') = 'array' then
      insert into public.ja_abordados (user_id, telefone)
      select r.user_id, tel
      from jsonb_array_elements_text(r.dados->'jaAbordados') as tel
      where coalesce(tel, '') <> ''
      on conflict (user_id, telefone) do nothing;
    end if;

  end loop;
end;
$migracao$;

-- =====================================================================
-- 6) RETENÇÃO — reescrita para as tabelas
-- =====================================================================
-- Com os leads em linhas, a regra que antes exigia remontar um JSONB inteiro
-- vira dois comandos. A ordem importa: guardar os telefones ANTES de apagar,
-- senão a informação some junto — foi exatamente o bug corrigido na 01.
create or replace function private.limpar_leads_antigos(dias int default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  corte timestamptz := now() - (dias || ' days')::interval;
  afetados integer := 0;
begin
  -- 1) telefones de quem já foi abordado e está saindo.
  --    'novo' fica de fora: ninguém falou com ele, então pode reaparecer
  --    numa busca futura como contato novo. 'fechado' nunca sai.
  insert into public.ja_abordados (user_id, telefone)
  select l.user_id, l.telefone
  from public.leads l
  where l.status in ('contatado', 'em_negociacao', 'perdido')
    and l.telefone <> ''
    and l.atualizado_em < corte
  on conflict (user_id, telefone) do nothing;

  -- 2) agora sim, apaga. O histórico vai junto pelo `on delete cascade`.
  delete from public.leads
  where status <> 'fechado'
    and atualizado_em < corte;

  get diagnostics afetados = row_count;
  return afetados;
end;
$fn$;

-- O agendamento criado na migração 01 continua valendo: ele chama
-- `private.limpar_leads_antigos(90)`, que agora é esta versão.

-- =====================================================================
-- 7) DEPOIS DE CONFERIR (não roda automático)
-- =====================================================================
-- Compare as contagens antes de aposentar a tabela antiga:
--
--   select
--     (select count(*) from public.leads)          as leads,
--     (select count(*) from public.lead_historico) as historico,
--     (select count(*) from public.templates)      as templates,
--     (select count(*) from public.user_config)    as configs,
--     (select count(*) from public.ja_abordados)   as ja_abordados;
--
-- Quando o app estiver rodando sobre as tabelas novas e os números baterem:
--
--   drop table public.app_data;
