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
  for select using (auth.uid() = user_id);

create policy "own_insert" on public.app_data
  for insert with check (auth.uid() = user_id);

create policy "own_update" on public.app_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
