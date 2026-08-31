// Dados do seu projeto Supabase.
//
// Estes dois valores vêm de variáveis de ambiente (arquivo `.env.local`, que
// NÃO vai para o Git). Copie `.env.example` para `.env.local` e preencha:
//
//   VITE_SUPABASE_URL       -> Project Settings → API → Project URL
//   VITE_SUPABASE_ANON_KEY  -> Project Settings → API → chave anon/publishable
//
// Em produção (Vercel), cadastre as duas em Settings → Environment Variables.
//
// Os valores NÃO são segredo: a chave anon/publishable é feita para rodar no
// navegador e aparece no bundle do site de qualquer forma. A proteção real vem
// das políticas de segurança por linha (RLS) no banco — ver
// `docs/supabase-setup.sql`. Ficam fora do código-fonte para que o repositório
// não amarre ninguém ao projeto Supabase de outra pessoa.
//
// Enquanto estiverem vazios, o app funciona em modo LOCAL (sem login, dados só
// no navegador). Ao preencher, ele passa a exigir login e sincronizar na nuvem.

export const SUPABASE_URL = ''
export const SUPABASE_ANON_KEY = ''
