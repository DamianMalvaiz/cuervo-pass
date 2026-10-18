// Aceptar el aviso de privacidad vigente (migración 0059). La RPC escribe la versión y la hora del SERVIDOR sobre la fila de quien llama.

import { supabase } from '@/lib/supabase';

/** Lanza si falla: «aceptar» sin que quede registrado no es aceptar, y la pantalla no debe dejar pasar. */
export async function aceptarAviso(version: string): Promise<void> {
  const { error } = await supabase.rpc('aceptar_aviso', { p_version: version });
  if (error) throw error;
}
