// Quitar el token push de quien cierra sesión · hallazgo 3, migración 0040.
//
// Vive aparte de `pushNotifications.ts` a propósito: aquel módulo importa
// `expo-notifications` y `expo-router` y llama a `setNotificationHandler` al
// cargarse. `useAuthStore` necesita solo esto, y arrastrar todo lo demás a cada
// prueba y a cada pantalla que toque el store no se justifica.

import { aviso } from '@/lib/registro';
import { supabase } from '@/lib/supabase';

/**
 * Borra la fila de `push_tokens` de `usuarioId`.
 *
 * Tiene que correr ANTES de `signOut`: la policy de borrado compara contra
 * `auth.uid()`, y sin sesión no hay quién sea dueño de la fila.
 *
 * NUNCA propaga. Se llama en medio de «Cerrar sesión» y un fallo de red no puede
 * impedir que la persona salga. El costo de que falle es conocido y acotado: el
 * token queda ligado a la cuenta anterior hasta que la siguiente persona inicie
 * sesión en ese teléfono y `registrarTokenPush` lo sobrescriba.
 */
export async function borrarTokenPush(usuarioId: string): Promise<void> {
  try {
    const { error } = await supabase.from('push_tokens').delete().eq('usuario_id', usuarioId);
    if (error) aviso('No se pudo borrar el token push al cerrar sesión', { detalle: error.message });
  } catch (e) {
    aviso('borrarTokenPush no respondió', undefined, e);
  }
}
