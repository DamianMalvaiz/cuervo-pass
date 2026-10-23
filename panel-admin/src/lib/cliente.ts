import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Lo que usa la app del cliente de Supabase. */
export type ClienteApp = Pick<SupabaseClient, 'auth' | 'functions'>;

/**
 * El cliente real. FALLA CERRADO: sin la URL o la clave pública del proyecto no hay cliente (y la pantalla lo dice), nunca uno apuntando «a algún sitio».
 * Los dos valores son públicos por diseño (van en cualquier bundle); la seguridad está en la sesión y en la función `admin`.
 */
export function crearClienteReal(): ClienteApp {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url?.trim() || !clave?.trim()) throw new Error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY al construir el panel.');
  return createClient(url, clave, { auth: { persistSession: true, autoRefreshToken: true } });
}
