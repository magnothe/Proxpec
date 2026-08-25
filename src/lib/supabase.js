import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig'

// Permite sobrescrever por variáveis de ambiente (opcional).
const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL || ''
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY || ''

export const supabaseConfigurado = Boolean(url && anon)

export const supabase = supabaseConfigurado
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

// Nome da tabela que guarda os dados (um registro por usuário).
export const TABELA_DADOS = 'app_data'
