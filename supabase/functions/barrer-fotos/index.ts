// Documento maestro v5 · §29 (retención) · AUD-10 · cierra la deuda que la 0021 declaró.
//
// La 0021 cambió un fallo ruidoso por una deuda visible, y lo dijo con todas
// sus letras:
//
//   «El cambio tiene un coste y conviene nombrarlo: encolar no borra. Si nadie
//    vacía esta tabla, los archivos siguen ahí.»
//
// Quien la vaciaba era `scripts/limpiar-fotos-huerfanas.mjs`, un script manual.
// O sea: el derecho de cancelación que promete el aviso de privacidad dependía
// de que alguien se acordara de correr un comando. Y mientras tanto —hasta la
// migración 0022— esos archivos seguían siendo legibles por cualquier cuenta.
// Tres decisiones defendidas una a una que, compuestas, reproducían el fallo
// original: el usuario borra, la app dice que borró, el archivo sigue ahí.
//
// Esto es el mismo barredor, invocable sin humano. La 0025 lo programa cada
// hora con pg_cron.
//
// Despliegue:
//   supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
//   supabase functions deploy barrer-fotos --no-verify-jwt
//
// `--no-verify-jwt` a propósito: no lo llama un usuario, lo llama la base. La
// autorización es el CRON_SECRET, comprobado abajo en tiempo constante.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const LOTE = 200;

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Comparación en tiempo constante, por la misma razón que `hmac.compare_digest`
// en el microservicio (AUD-12): `a !== b` corta en el primer byte distinto.
// Se comparan bytes y no cadenas para que la longitud tampoco filtre por la
// vía del recorrido.
function igualEnTiempoConstante(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  // Longitudes distintas no pueden ser iguales, pero se recorre igual para no
  // devolver antes.
  const n = Math.max(ba.length, bb.length);
  let dif = ba.length ^ bb.length;
  for (let i = 0; i < n; i++) dif |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  return dif === 0;
}

Deno.serve(async (req) => {
  // Sin manejo de OPTIONS ni cabeceras CORS, al contrario que las otras tres
  // funciones. No es un olvido: a esta la llama `pg_cron` a través de pg_net,
  // nunca un navegador. Abrirla a peticiones de navegador no habilita ningún
  // caso de uso y sí amplía su superficie, aunque siga exigiendo el CRON_SECRET.
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  const esperado = Deno.env.get('CRON_SECRET');
  // Fallar CERRADO, igual que el microservicio tras la ORDEN A.2: sin secreto
  // configurado no se sirve, en vez de quedar abierto.
  if (!esperado) {
    console.error('barrer-fotos: CRON_SECRET no está configurado');
    return json({ error: 'no configurado' }, 503);
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (!igualEnTiempoConstante(auth, `Bearer ${esperado}`)) {
    return json({ error: 'no autorizado' }, 401);
  }

  const servicio = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Las más viejas primero: si la cola crece más rápido de lo que se barre,
  // que al menos no se quede nada atrás indefinidamente.
  const { data: cola, error: eCola } = await servicio
    .from('fotos_huerfanas')
    .select('ruta')
    .order('encolada_en', { ascending: true })
    .limit(LOTE);

  if (eCola) {
    console.error('barrer-fotos: no se pudo leer la cola', eCola.message);
    return json({ error: 'no se pudo leer la cola' }, 500);
  }
  if (!cola?.length) return json({ barridas: 0, pendientes: 0 }, 200);

  const rutas = cola.map((c) => c.ruta as string);
  const { data: borradas, error: eStorage } = await servicio.storage.from('fotos').remove(rutas);

  if (eStorage) {
    // La cola NO se toca. Al revés, un fallo del almacenamiento borraría el
    // único registro de que esos archivos existen.
    console.error('barrer-fotos: Storage rechazó el borrado', eStorage.message);
    return json({ error: 'storage rechazó el borrado', pendientes: rutas.length }, 502);
  }

  // Solo se quitan de la cola las que Storage CONFIRMÓ. Si devolvió menos de
  // las pedidas, las que falten se reintentan en la siguiente pasada.
  const confirmadas = (borradas ?? []).map((o) => o.name as string);
  if (confirmadas.length) {
    const { error: eBorrar } = await servicio
      .from('fotos_huerfanas')
      .delete()
      .in('ruta', confirmadas);
    if (eBorrar) {
      console.error('barrer-fotos: archivos borrados pero la cola no se vació', eBorrar.message);
      return json({ error: 'cola no vaciada', barridas: confirmadas.length }, 500);
    }
  }

  const { count } = await servicio
    .from('fotos_huerfanas')
    .select('ruta', { count: 'exact', head: true });

  console.log('barrer-fotos', { barridas: confirmadas.length, pendientes: count ?? 0 });
  return json({ barridas: confirmadas.length, pendientes: count ?? 0 }, 200);
});
