-- Prospecta — migração 01
-- Rode este arquivo inteiro no SQL Editor do Supabase, DEPOIS do
-- `supabase-setup.sql`. Pode rodar mais de uma vez sem problema.
--
-- O que ele faz:
--   1) corrige a limpeza automática, que estava perdendo a lista de "já
--      abordados" (bug com consequência visível para o usuário);
--   2) passa o carimbo de `atualizado_em` para o servidor;
--   3) agenda a limpeza de fato.

-- =====================================================================
-- 1) LIMPEZA AUTOMÁTICA — correção
-- =====================================================================
-- O comentário da versão anterior dizia "regra igual à do app, em
-- src/utils/retencao.js". Não era: o app, ao apagar um lead já abordado,
-- guarda o telefone dele em `dados.jaAbordados` para o usuário não reabordar
-- quem já recebeu mensagem. A função SQL só trocava `dados.leads` e deixava
-- `jaAbordados` intocado.
--
-- O efeito aparecia justamente em quem esta função existe para atender: as
-- contas dormentes. O lead sumia e a proteção sumia junto, então numa busca
-- futura a pessoa reaparecia como contato novo e levava a mesma abordagem de
-- novo. Agora a função mantém as duas pontas.
create or replace function private.limpar_leads_antigos(dias int default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  corte text := to_char((now() at time zone 'utc') - (dias || ' days')::interval,
                        'YYYY-MM-DD"T"HH24:MI:SS');
  afetados integer := 0;
begin
  with calc as (
    select
      a.user_id,

      -- Os leads que ficam: os fechados (venda ganha é histórico e nunca
      -- some) e os que foram mexidos dentro do prazo.
      coalesce((
        select jsonb_agg(l)
        from jsonb_array_elements(a.dados->'leads') l
        where l->>'status' = 'fechado'
           or coalesce(l->>'atualizadoEm', l->>'criadoEm', '9999') > corte
      ), '[]'::jsonb) as mantidos,

      -- A lista de já abordados: o que já estava lá, mais o telefone de cada
      -- lead que está saindo agora E que já tinha recebido contato.
      --
      -- 'novo' fica de fora de propósito: ninguém falou com ele, então pode
      -- reaparecer numa busca futura como contato novo, sem problema.
      -- 'fechado' nunca entra porque nunca é apagado.
      coalesce((
        select jsonb_agg(distinct tel)
        from (
          -- os que já estavam na lista. O `case` protege contra uma conta
          -- cujo `jaAbordados` não seja um array (ou nem exista): sem ele,
          -- jsonb_array_elements_text derruba a função inteira e NENHUMA
          -- conta é limpa por causa de um registro torto.
          select tel
          from jsonb_array_elements_text(
                 case when jsonb_typeof(a.dados->'jaAbordados') = 'array'
                      then a.dados->'jaAbordados'
                      else '[]'::jsonb
                 end
               ) as tel
          union
          -- os que saem agora
          select l->>'telefone'
          from jsonb_array_elements(a.dados->'leads') l
          where l->>'status' in ('contatado', 'em_negociacao', 'perdido')
            and coalesce(l->>'telefone', '') <> ''
            and coalesce(l->>'atualizadoEm', l->>'criadoEm', '9999') <= corte
        ) t
      ), '[]'::jsonb) as abordados

    from public.app_data a
    where jsonb_typeof(a.dados->'leads') = 'array'
  )
  update public.app_data a
     set dados = jsonb_set(
                   jsonb_set(a.dados, '{leads}', c.mantidos),
                   '{jaAbordados}', c.abordados,
                   true  -- cria a chave se a conta ainda não tiver nenhuma
                 )
    from calc c
   where a.user_id = c.user_id
     -- só grava quem realmente mudou, para não inflar o histórico à toa
     and jsonb_array_length(a.dados->'leads') <> jsonb_array_length(c.mantidos);

  get diagnostics afetados = row_count;
  return afetados;
end;
$fn$;

-- =====================================================================
-- 2) `atualizado_em` carimbado pelo servidor
-- =====================================================================
-- Hoje quem manda esse valor é o navegador (`atualizado_em: agora()` no
-- upsert do StoreContext). Relógio de cliente erra — fuso trocado, máquina
-- atrasada, horário adulterado — e aí a coluna mente. Com o gatilho, o valor
-- passa a vir do banco e o que o cliente enviar é ignorado.
--
-- Isso também deixa a coluna confiável para, mais à frente, servir de base
-- para detectar duas abas escrevendo por cima uma da outra.
create or replace function private.toca_atualizado_em()
returns trigger
language plpgsql
as $fn$
begin
  new.atualizado_em := now();
  return new;
end;
$fn$;

drop trigger if exists app_data_atualizado_em on public.app_data;
create trigger app_data_atualizado_em
  before insert or update on public.app_data
  for each row execute function private.toca_atualizado_em();

-- =====================================================================
-- 3) AGENDAMENTO
-- =====================================================================
-- No setup anterior estas linhas estavam comentadas, então a função existia
-- mas nunca rodava — e como o app já limpa ao abrir, o efeito disso só
-- apareceria nas contas que ninguém abre, que são o alvo da função.
--
-- Se o `create extension` falhar por permissão, habilite o pg_cron pelo
-- painel em Database → Extensions e rode o resto de novo.
create extension if not exists pg_cron;

-- Remove o agendamento antigo antes de recriar, para não duplicar o job
-- se esta migração rodar duas vezes.
select cron.unschedule('limpar-leads')
where exists (select 1 from cron.job where jobname = 'limpar-leads');

-- 03:00 UTC = meia-noite em Brasília.
select cron.schedule(
  'limpar-leads',
  '0 3 * * *',
  $job$select private.limpar_leads_antigos(90)$job$
);

-- =====================================================================
-- 4) CONFERÊNCIA (opcional, só leitura — não altera nada)
-- =====================================================================
-- Rode ANTES de confiar no agendamento, para ver o que a limpeza faria
-- hoje em cada conta. Se `leads_a_remover` for 0 em todas, não há nada a
-- limpar ainda e o resultado vazio é o esperado.
--
--   select
--     a.user_id,
--     jsonb_array_length(a.dados->'leads') as leads_hoje,
--     (select count(*)
--        from jsonb_array_elements(a.dados->'leads') l
--       where l->>'status' <> 'fechado'
--         and coalesce(l->>'atualizadoEm', l->>'criadoEm', '9999')
--             <= to_char((now() at time zone 'utc') - interval '90 days',
--                        'YYYY-MM-DD"T"HH24:MI:SS')
--     ) as leads_a_remover,
--     coalesce(jsonb_array_length(
--       case when jsonb_typeof(a.dados->'jaAbordados') = 'array'
--            then a.dados->'jaAbordados' else '[]'::jsonb end), 0)
--       as ja_abordados_hoje
--   from public.app_data a
--   where jsonb_typeof(a.dados->'leads') = 'array';
--
-- Para executar a limpeza na mão (aqui no SQL Editor funciona, pois roda
-- como service_role):
--
--   select private.limpar_leads_antigos(90);
--
-- Para conferir que o agendamento ficou de pé:
--
--   select jobname, schedule, active from cron.job where jobname = 'limpar-leads';
