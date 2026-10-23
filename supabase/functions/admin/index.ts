// Panel de administración · la ÚNICA puerta (migración 0060).
//
// La app llama aquí con la sesión de la persona. La función comprueba en la base que es un admin aprobado y solo entonces ejecuta, con la
// llave de servicio, funciones que ni `authenticated` ni `anon` pueden llamar. La llave de servicio nunca sale de aquí.
//
//   resumen · verificaciones · moderacion · errores   lecturas (errores = los que registra la app, migración 0068)
//   documentos                                 firma enlaces de 10 min a la evidencia y DEJA RASTRO de quién la miró
//   resolver                                   aprobar / rechazar una verificación (`resolver_verificacion`)
//   moderar                                    ocultar o restaurar una reseña o un negocio (con motivo y bitácora)
//   borrar_error                               «ya lo vi»: quita un grupo de errores (queda en la bitácora)
//   modo_demo                                  enciende o apaga los pagos simulados
//
// Quien llama NO manda su id: sale de la sesión. Cada función SQL repite la comprobación de admin, así que un error aquí no basta para
// que la base ejecute algo a nombre de quien no lo es.
//
// Despliegue (con verificación de JWT, valor por omisión): supabase functions deploy admin

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { rutasDeDocumentos, validarSolicitud } from './politica.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

/** Códigos de la base → HTTP. El mensaje de Postgres no se reenvía: puede traer nombres internos. */
function respuestaDeError(e: { code?: string }): Response {
  switch (e.code) {
    case 'CP007': return json({ error: 'prohibido' }, 403);
    case 'CP005': return json({ error: 'no_pendiente' }, 409);
    case 'CP006': return json({ error: 'motivo_requerido' }, 400);
    case '22023': return json({ error: 'datos_invalidos' }, 400);
    case 'P0002': return json({ error: 'no_existe' }, 404);
    default:
      console.error('admin: error de la base', e.code);
      return json({ error: 'error_interno' }, 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'no autorizado' }, 401);

  const requeridos = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const faltantes = requeridos.filter((n) => !Deno.env.get(n)?.trim());
  if (faltantes.length > 0) {
    console.error('admin: faltan secrets', { faltantes });   // NOMBRES, nunca valores
    return json({ error: 'sin_configurar' }, 503);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'sesión inválida' }, 401);

  const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Admin aprobado, comprobado en la BASE. Un error de lectura NO se trata como «no es admin» ni como «sí es»: se dice como fallo.
  const { data: esAdmin, error: eAdmin } = await servicio.rpc('es_admin_aprobado', { p_uid: user.id });
  if (eAdmin) {
    console.error('admin: no se pudo comprobar el rol', eAdmin.code);
    return json({ error: 'error_interno' }, 500);
  }
  // Mismo 403 para «no eres admin» que para cualquier cuenta: no se confirma que exista un panel a quien no debe verlo.
  if (esAdmin !== true) return json({ error: 'prohibido' }, 403);

  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    return json({ error: 'cuerpo inválido' }, 400);
  }
  const v = validarSolicitud(crudo);
  if (!v.ok) return json({ error: v.codigo }, 400);
  const s = v.solicitud;
  const admin = user.id;

  switch (s.accion) {
    case 'resumen': {
      const { data, error } = await servicio.rpc('admin_resumen', { p_admin: admin });
      if (error) return respuestaDeError(error);
      return json({ resumen: data?.[0] ?? null }, 200);
    }
    case 'resumen_detalle': {
      const { data, error } = await servicio.rpc('admin_resumen_detalle', { p_admin: admin });
      if (error) return respuestaDeError(error);
      return json({ detalle: data ?? null }, 200);
    }
    case 'verificaciones': {
      const { data, error } = await servicio.rpc('admin_listar_verificaciones', { p_admin: admin });
      if (error) return respuestaDeError(error);
      return json({ verificaciones: data ?? [] }, 200);
    }
    case 'moderacion': {
      const { data, error } = await servicio.rpc('admin_listar_moderacion', { p_admin: admin });
      if (error) return respuestaDeError(error);
      return json({ moderacion: data ?? [] }, 200);
    }
    case 'errores': {
      const { data, error } = await servicio.rpc('admin_listar_errores', { p_admin: admin });
      if (error) return respuestaDeError(error);
      return json({ errores: data ?? [] }, 200);
    }
    case 'borrar_error': {
      const { error } = await servicio.rpc('admin_borrar_error', { p_admin: admin, p_id: s.id });
      if (error) return respuestaDeError(error);
      return json({ ok: true }, 200);
    }
    case 'documentos': {
      // Primero el rastro: si no se puede registrar quién mira, no se muestra nada.
      const { error: eRastro } = await servicio.rpc('registrar_acceso_documentos', {
        p_admin: admin, p_usuario: s.usuarioId, p_rol: s.rol,
      });
      if (eRastro) return respuestaDeError(eRastro);

      const { data: fila, error: eFila } = await servicio
        .from('verificaciones_vendedor')
        .select('usuario_id, ine_frente, ine_reverso, fotos, ine_borrada_en')
        .eq('usuario_id', s.usuarioId)
        .eq('rol', s.rol)
        .maybeSingle();
      if (eFila) {
        console.error('admin: no se pudo leer la evidencia', eFila.code);
        return json({ error: 'error_interno' }, 500);
      }
      if (!fila) return json({ error: 'no_existe' }, 404);

      const rutas = rutasDeDocumentos(fila);
      if (rutas.length === 0) return json({ documentos: [] }, 200);
      const { data: firmadas, error: eFirma } = await servicio.storage
        .from('verificacion')
        .createSignedUrls(rutas.map((r) => r.ruta), 600);
      if (eFirma) {
        console.error('admin: no se pudieron firmar los enlaces', eFirma.message);
        return json({ error: 'error_interno' }, 500);
      }
      const documentos = rutas.map((r) => ({
        etiqueta: r.etiqueta,
        url: firmadas?.find((f) => f.path === r.ruta)?.signedUrl ?? null,
      }));
      return json({ documentos, caduca_en_segundos: 600 }, 200);
    }
    case 'resolver': {
      const { error } = await servicio.rpc('resolver_verificacion', {
        p_usuario: s.usuarioId, p_rol: s.rol, p_aprobar: s.aprobar, p_motivo: s.motivo, p_admin: admin,
      });
      if (error) return respuestaDeError(error);
      return json({ ok: true }, 200);
    }
    case 'moderar': {
      const { error } = await servicio.rpc('moderar_contenido', {
        p_admin: admin, p_tipo: s.tipo, p_id: s.id, p_ocultar: s.ocultar, p_motivo: s.motivo,
      });
      if (error) return respuestaDeError(error);
      return json({ ok: true }, 200);
    }
    case 'modo_demo': {
      const { data, error } = await servicio.rpc('fijar_demo_mode', { p_admin: admin, p_activo: s.activo });
      if (error) return respuestaDeError(error);
      return json({ modo_demo: data === true }, 200);
    }
  }
});
