// Borrado programado de la INE · Verificación de vendedor (migración 0049/0050).
//
// La INE es lo más sensible que guarda la app, y el aviso de privacidad promete conservarla solo mientras hace falta.
// Al aprobar una verificación, `resolver_verificacion` fija `ine_borrar_en` (30 días). Esta función, llamada cada hora
// por `pg_cron`, borra del bucket privado `verificacion` el frente y el reverso de las que ya llegaron a esa fecha y
// marca `ine_borrada_en`. Se conserva el estado «verificado», la fecha y quién aprobó. Las fotos del local o del
// inmueble NO se borran.
//
// Despliegue (igual que `barrer-fotos`; usa el mismo CRON_SECRET):
//   supabase functions deploy barrer-verificaciones --no-verify-jwt
//
// `--no-verify-jwt` a propósito: no lo llama un usuario, lo llama la base. La autorización es el CRON_SECRET.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { esRutaDeEvidenciaHuerfanaSegura, igualEnTiempoConstante, rutasDeIne } from './politica.ts';

const LOTE = 100;

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

async function barrerHuerfanas(): Promise<number> {
  const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await servicio.rpc('evidencia_huerfana', { p_limite: LOTE });
  if (error) {
    console.error('barrer-verificaciones: no se pudieron listar las huérfanas', error.code);
    return 0;
  }
  const listadas = ((data ?? []) as { ruta: string }[]).map((f) => f.ruta);
  // La base ya filtra por forma; aquí se vuelve a comprobar antes de borrar con la llave de servicio.
  const rutas = listadas.filter(esRutaDeEvidenciaHuerfanaSegura);
  if (rutas.length < listadas.length) {
    console.error('barrer-verificaciones: rutas huérfanas con forma inesperada, no se tocan', listadas.length - rutas.length);
  }
  if (rutas.length === 0) return 0;
  const { error: eStorage } = await servicio.storage.from('verificacion').remove(rutas);
  if (eStorage) {
    console.error('barrer-verificaciones: Storage rechazó el borrado de huérfanas', eStorage.message);
    return 0;
  }
  return rutas.length;
}

Deno.serve(async (req) => {
  // Sin CORS, como `barrer-fotos`: la llama pg_cron a través de pg_net, nunca un navegador.
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  // Fallar CERRADO: sin secreto configurado no se sirve.
  const esperado = Deno.env.get('CRON_SECRET');
  if (!esperado) {
    console.error('barrer-verificaciones: CRON_SECRET no está configurado');
    return json({ error: 'no configurado' }, 503);
  }
  const auth = req.headers.get('Authorization') ?? '';
  if (!igualEnTiempoConstante(auth, `Bearer ${esperado}`)) return json({ error: 'no autorizado' }, 401);

  const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Las más viejas primero.
  const { data: filas, error: eLectura } = await servicio
    .from('verificaciones_vendedor')
    .select('usuario_id, rol, ine_frente, ine_reverso')
    .not('ine_borrar_en', 'is', null)
    .lte('ine_borrar_en', new Date().toISOString())
    .is('ine_borrada_en', null)
    .order('ine_borrar_en', { ascending: true })
    .limit(LOTE);

  if (eLectura) {
    console.error('barrer-verificaciones: no se pudo leer', eLectura.message);
    return json({ error: 'no se pudo leer' }, 500);
  }

  // Segunda pasada: evidencia (INE, reverso, fotos del lugar) que ninguna verificación apunta (subidas a medias, entregas anteriores a un reenvío). Va ANTES de salir por
  // «no hay filas», porque no depende de ellas. Un fallo aquí no tumba la primera pasada: se registra y se reintenta en la hora siguiente.
  const huerfanasBorradas = await barrerHuerfanas();

  if (!filas?.length) return json({ borradas: 0, huerfanas: huerfanasBorradas }, 200);

  let borradas = 0;
  for (const fila of filas) {
    const rutas = rutasDeIne(fila);
    // Ninguna ruta válida: no hay nada que borrar, y NO se marca como borrada (sería afirmar algo falso).
    if (rutas.length === 0) {
      console.error('barrer-verificaciones: fila sin rutas de INE válidas', fila.usuario_id, fila.rol);
      continue;
    }
    const { error: eStorage } = await servicio.storage.from('verificacion').remove(rutas);
    if (eStorage) {
      // No se marca: se reintenta en la siguiente pasada. Marcarla borraría el único rastro de que sigue ahí.
      console.error('barrer-verificaciones: Storage rechazó el borrado', eStorage.message);
      continue;
    }
    const { error: eMarca } = await servicio
      .from('verificaciones_vendedor')
      .update({ ine_borrada_en: new Date().toISOString() })
      .eq('usuario_id', fila.usuario_id)
      .eq('rol', fila.rol);
    if (eMarca) {
      console.error('barrer-verificaciones: archivos borrados pero sin marcar', eMarca.message);
      continue;
    }
    borradas++;
  }

  console.log('barrer-verificaciones', { borradas, revisadas: filas.length, huerfanas: huerfanasBorradas });
  return json({ borradas, revisadas: filas.length, huerfanas: huerfanasBorradas }, 200);
});
