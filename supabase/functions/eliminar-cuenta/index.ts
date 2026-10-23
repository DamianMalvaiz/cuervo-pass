// Documento maestro v5 · §29 — derecho de CANCELACIÓN (ARCO).
//
// Prometerlo en el aviso de privacidad y no implementarlo es peor que no
// prometerlo. Borrar la cuenta de Supabase Auth dispara el `on delete cascade`
// de todo el esquema, y con él desaparecen perfil, publicaciones, mensajes y
// contactos.
//
// Las FOTOS son el caso aparte: viven en Storage, no en una tabla con clave
// foránea, así que ninguna cascada las alcanza. Se borran aquí explícitamente
// (ver el bloque de abajo y la migración 0021).
//
// Requiere service_role, así que vive aquí y no en la app.
//   supabase functions deploy eliminar-cuenta

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { carpetasDeLaCuenta, ejecutarBorrado, rutasDeEntradas } from './politica.ts';

// CORS · END-14 · `req.method !== 'POST'` devolvía 405 también al preflight, así
// que un navegador nunca llegaba a hacer la petición real. `package.json` tiene
// script `web` y `react-native-web` en dependencias, así que la app web está
// contemplada y esto la rompía en silencio.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

/** Lo mínimo de Storage que esta función usa: así no depende de los genéricos del cliente completo. */
interface Almacen {
  storage: {
    from: (bucket: string) => {
      list: (
        carpeta: string,
        opciones: { limit: number; offset: number },
      ) => Promise<{ data: { name: string; id: string | null }[] | null; error: { message: string } | null }>;
    };
  };
}

/** Lista TODOS los archivos de una carpeta (pagina de 100 en 100) y devuelve sus rutas completas. */
async function archivosDe(servicio: Almacen, bucket: string, carpeta: string): Promise<string[]> {
  const rutas: string[] = [];
  for (let desplazamiento = 0; ; desplazamiento += 100) {
    const { data, error } = await servicio.storage.from(bucket).list(carpeta, { limit: 100, offset: desplazamiento });
    if (error) {
      console.error('eliminar-cuenta: no se pudo listar una carpeta', { bucket, mensaje: error.message });
      break;
    }
    rutas.push(...rutasDeEntradas(carpeta, data));
    if (!data || data.length < 100) break;
  }
  return rutas;
}

Deno.serve(async (req) => {
  // El preflight va ANTES de cualquier comprobación: no lleva credenciales por
  // definición, así que exigirlas aquí lo rechazaría siempre.
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'no autorizado' }, 401);

  // La identidad la determina el token del usuario, NUNCA un id en el cuerpo:
  // si la función aceptara `{ usuario_id }`, cualquiera borraría la cuenta de
  // cualquiera con una sola petición.
  const anon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await anon.auth.getUser();
  if (!user) return json({ error: 'sesión inválida' }, 401);

  const servicio = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // El ORDEN lo decide `ejecutarBorrado` (politica.ts): rutas, luego la CUENTA, y solo después los archivos. Antes se borraban los archivos
  // primero y, si `deleteUser` fallaba, la cuenta seguía viva con sus fotos y su evidencia ya destruidas.
  //
  // Las fotos se borran AQUÍ, por la Storage API, y no desde el trigger. Hasta la migración 0021, `trg_limpiar_fotos` hacía `delete from
  // storage.objects`; Supabase añadió una barrera que lo prohíbe y el trigger reventaba con toda la transacción: la cuenta seguía existiendo y el
  // derecho de cancelación llevaba días sin funcionar para quien hubiera subido una foto. El trigger ahora solo ENCOLA las rutas en
  // `fotos_huerfanas`; borrarlas de verdad es trabajo de quien sí puede hablar con la Storage API: esto.
  const resultado = await ejecutarBorrado({
    recogerRutas: async () => {
      const fotos: string[] = [`perfiles/${user.id}.jpg`];

      const { data: publicaciones } = await servicio.from('publicaciones').select('fotos').eq('usuario_id', user.id);
      for (const p of publicaciones ?? []) {
        for (const ruta of (p.fotos ?? []) as string[]) {
          // Las publicaciones sembradas guardan URLs de Unsplash, no rutas del bucket: pedir a Storage que borre una URL externa no es un
          // error, pero sí ruido en una operación que conviene poder leer.
          if (!ruta.startsWith('http')) fotos.push(ruta);
        }
      }

      // Lo que las filas NO alcanzan: las fotos de los NEGOCIOS (y las de sus productos) y la evidencia de verificación (INE, reverso, fotos
      // del lugar). Las filas se borran en cascada; los archivos no. Antes quedaban para siempre, y el aviso de privacidad promete lo contrario.
      const { data: negocios } = await servicio.from('negocios').select('id').eq('usuario_id', user.id);
      const carpetas = carpetasDeLaCuenta(user.id, (negocios ?? []).map((n: { id: string }) => n.id));
      const verificacion: string[] = [];
      for (const c of carpetas.fotos) fotos.push(...(await archivosDe(servicio, 'fotos', c)));
      for (const c of carpetas.verificacion) verificacion.push(...(await archivosDe(servicio, 'verificacion', c)));
      return { fotos: [...new Set(fotos)], verificacion };
    },

    borrarCuenta: async () => {
      const { error } = await servicio.auth.admin.deleteUser(user.id);
      if (!error) return null;
      // El mensaje de Auth puede traer nombres internos de tablas o restricciones: va al registro del servidor, no al cliente.
      console.error('eliminar-cuenta: no se pudo borrar la cuenta', { usuario: user.id, mensaje: error.message });
      return error.message;
    },

    borrarFotos: async (rutas) => {
      // Si esto falla se sigue: dejar archivos huérfanos es malo, pero negarle a alguien el borrado de su cuenta por un fallo de almacenamiento
      // es peor. Lo que quede sin borrar lo encola el trigger y lo recoge el barredor.
      const { error: eStorage } = await servicio.storage.from('fotos').remove(rutas);
      if (eStorage) {
        console.error('eliminar-cuenta: fallo al borrar fotos', { usuario: user.id, mensaje: eStorage.message });
        return; // las rutas se quedan en la cola: el barredor aún las puede recoger
      }
      // Las rutas ya borradas no necesitan barrido. Quitarlas de la cola evita que el verificador pre-demo señale trabajo que ya está hecho.
      await servicio.from('fotos_huerfanas').delete().in('ruta', rutas);
    },

    borrarVerificacion: async (rutas) => {
      if (rutas.length === 0) return;
      const { error } = await servicio.storage.from('verificacion').remove(rutas);
      // Se sigue: la INE la recoge el barrido de huérfanas (0058/0063) en cuanto su fila desaparece.
      if (error) console.error('eliminar-cuenta: fallo al borrar la evidencia de verificación', { usuario: user.id, mensaje: error.message });
    },
  });

  // Mismo cuerpo para cualquier fallo: la causa ya quedó en el registro del servidor.
  if (!resultado.ok) return json({ error: 'no_se_pudo_eliminar' }, 500);
  return json({ eliminada: true, fotosBorradas: resultado.fotos, evidenciaBorrada: resultado.evidencia }, 200);
});
