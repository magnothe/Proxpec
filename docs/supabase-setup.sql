-- Prospecta — configuração do banco no Supabase
-- Cole tudo isto no SQL Editor do Supabase e clique em "Run".
--
-- ATENÇÃO: este arquivo sozinho não está completo. Depois dele, rode
-- `supabase-migracao-01.sql`, que corrige a limpeza automática (a versão
-- daqui perde a lista de "já abordados") e agenda o job.

-- 1) Tabela que guarda todos os dados do app (um registro por usuário)
create table if not exists public.app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- 2) Ativa a segurança por linha (cada usuário só enxerga o próprio registro)
alter table public.app_data enable row level security;

-- 3) Políticas de acesso
drop policy if exists "own_select" on public.app_data;
drop policy if exists "own_insert" on public.app_data;
drop policy if exists "own_update" on public.app_data;

create policy "own_select" on public.app_data
  for select using ((select auth.uid()) = user_id);

create policy "own_insert" on public.app_data
  for insert with check ((select auth.uid()) = user_id);

create policy "own_update" on public.app_data
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- =====================================================================
-- 4) SCHEMA PRIVADO PARA FUNÇÕES INTERNAS
-- =====================================================================
-- Tudo que está em `public` vira endpoint HTTP automaticamente, em
-- /rest/v1/rpc/<nome>, chamável por qualquer um com a chave publicável — que
-- está visível no JavaScript do site. Uma função `security definer` exposta
-- assim roda com permissões de administrador para um visitante anônimo.
-- O schema `private` não é exposto pelo PostgREST.
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- =====================================================================
-- 5) LIMPEZA AUTOMÁTICA DE LEADS ANTIGOS
-- =====================================================================
-- O app já limpa os leads antigos quando o usuário abre a tela. Isto aqui
-- cobre as contas dormentes, que nunca abrem o app e por isso nunca limpam.
--
-- Regra (igual à do app, em src/utils/retencao.js):
--   apaga leads parados há mais de 90 dias, EXCETO os 'fechado'.
--
-- Sobre a comparação de datas: as datas são gravadas em ISO-8601, que ordena
-- igual cronologicamente como texto. Comparar como TEXTO em vez de fazer cast
-- para timestamptz evita que um registro com data corrompida derrube a função
-- inteira — data ilegível simplesmente não bate a condição e o lead é mantido,
-- que é o padrão seguro.

-- Fica em `private` pelo mesmo motivo explicado acima — e aqui o risco era
-- concreto: em `public`, qualquer visitante anônimo podia chamar
--   POST /rest/v1/rpc/limpar_leads_antigos  {"dias": 0}
-- e apagar os leads de TODOS os usuários de uma vez.
create or replace function private.limpar_leads_antigos(dias int default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  corte text := to_char((now() at time zone 'utc') - (dias || ' days')::interval,
                        'YYYY-MM-DD"T"HH24:MI:SS');
  afetados integer := 0;
begin
  with calc as (
    select
      a.user_id,
      coalesce((
        select jsonb_agg(l)
        from jsonb_array_elements(a.dados->'leads') l
        where l->>'status' = 'fechado'
           or coalesce(l->>'atualizadoEm', l->>'criadoEm', '9999') > corte
      ), '[]'::jsonb) as mantidos
    from public.app_data a
    where jsonb_typeof(a.dados->'leads') = 'array'
  )
  update public.app_data a
     set dados = jsonb_set(a.dados, '{leads}', c.mantidos),
         atualizado_em = now()
    from calc c
   where a.user_id = c.user_id
     -- só grava quem realmente mudou, para não inflar o histórico à toa
     and jsonb_array_length(a.dados->'leads') <> jsonb_array_length(c.mantidos);

  get diagnostics afetados = row_count;
  return afetados;
end;
$$;

-- Remove a versão antiga, que ficava exposta na API.
drop function if exists public.limpar_leads_antigos(int);

-- Agenda para rodar toda madrugada (03:00 UTC = 00:00 em Brasília).
-- Requer a extensão pg_cron habilitada em Database > Extensions.
-- create extension if not exists pg_cron;
-- select cron.schedule('limpar-leads', '0 3 * * *', $$select private.limpar_leads_antigos(90)$$);

-- Para rodar na mão (aqui no SQL Editor funciona, pois usa service_role):
--   select private.limpar_leads_antigos(90);

