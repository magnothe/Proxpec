-- Prospecta — configuração do banco no Supabase
-- Cole tudo isto no SQL Editor do Supabase e clique em "Run".

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
-- 4) PLANOS  (free / premium)
-- =====================================================================
-- A regra de ouro: o usuário pode LER o próprio plano, mas NUNCA escrever.
-- Se o plano morasse no JSONB de app_data (que o cliente grava), qualquer
-- pessoa abriria o DevTools e viraria premium de graça.

create table if not exists public.perfis (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  plano      text not null default 'free' check (plano in ('free', 'premium')),
  expira_em  timestamptz,
  criado_em  timestamptz not null default now()
);

alter table public.perfis enable row level security;

drop policy if exists "perfil_own_select" on public.perfis;

-- Só SELECT. Sem policy de insert/update, ninguém com a chave anon escreve
-- aqui: só o service_role (seu backend / painel) consegue promover alguém.
create policy "perfil_own_select" on public.perfis
  for select using ((select auth.uid()) = user_id);

-- IMPORTANTE: funções internas ficam no schema `private`, NUNCA no `public`.
--
-- Tudo que está em `public` vira endpoint HTTP automaticamente, em
-- /rest/v1/rpc/<nome>, chamável por qualquer um com a chave publicável — que
-- está visível no JavaScript do site. Uma função `security definer` exposta
-- assim roda com permissões de administrador para um visitante anônimo.
-- O schema `private` não é exposto pelo PostgREST.
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- Cria o perfil automaticamente quando alguém se cadastra.
create or replace function private.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function private.criar_perfil();

-- Remove a versão antiga, que ficava exposta na API.
drop function if exists public.criar_perfil();

-- Preenche perfis para quem já existia antes desta migração.
insert into public.perfis (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- Um plano premium vencido volta a valer como free.
--
-- `security_invoker = on` é obrigatório aqui. Sem isso a view roda com as
-- permissões de QUEM A CRIOU (comportamento padrão do Postgres), ignorando o
-- RLS de quem consulta — é o que o verificador do Supabase acusa como
-- "SECURITY DEFINER view". Com invoker ligado, a policy de perfis vale normal.
create or replace view public.meu_plano
with (security_invoker = on)
as
select
  user_id,
  case
    when plano = 'premium' and (expira_em is null or expira_em > now()) then 'premium'
    else 'free'
  end as plano,
  expira_em
from public.perfis
where user_id = auth.uid();

-- Para promover alguém (rode no SQL Editor, que usa service_role):
--   insert into public.perfis (user_id, plano, expira_em)
--   values ('<uuid-do-usuario>', 'premium', now() + interval '1 year')
--   on conflict (user_id) do update
--     set plano = excluded.plano, expira_em = excluded.expira_em;

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

-- Fica em `private` pelo mesmo motivo da criar_perfil — e aqui o risco era
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

-- =====================================================================
-- 6) SEU ACESSO (dono do sistema) — PREMIUM VITALÍCIO
-- =====================================================================
-- `expira_em = null` significa "não vence nunca": a view `meu_plano` só
-- rebaixa para free quando expira_em existe E já passou.

-- OPÇÃO A — pelo e-mail com que você entra no app (recomendado).
insert into public.perfis (user_id, plano, expira_em)
select id, 'premium', null
  from auth.users
 where email = 'magnothefilho@gmail.com'
on conflict (user_id) do update
  set plano = 'premium',
      expira_em = null;

-- OPÇÃO B — se você é o ÚNICO usuário cadastrado, promove sem precisar
-- digitar e-mail nenhum. CUIDADO: rodar isto depois de ter clientes
-- tornaria todos eles premium de graça.
--
--   update public.perfis set plano = 'premium', expira_em = null;

-- Confira o resultado (deve listar você como premium, expira_em vazio):
--   select u.email, p.plano, p.expira_em
--     from public.perfis p
--     join auth.users u on u.id = p.user_id
--    order by p.criado_em;
