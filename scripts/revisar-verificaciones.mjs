// Revisión de verificaciones de vendedor (migración 0049): lista las pendientes con enlaces TEMPORALES a la evidencia,
// y las aprueba o rechaza llamando a `resolver_verificacion`.
//
// Quién revisa es un admin aprobado (`roles_usuario`, rol admin): su id queda escrito como responsable. Por omisión es
// el admin sembrado; con `--admin <uuid>` se indica otro.
//
// La INE es lo más sensible de la base. Los enlaces caducan a los 10 minutos y NO se guardan en ningún archivo: se
// imprimen en la terminal y nada más. Al aprobar, la INE se programa para borrarse a los 30 días (0050).
//
// Uso:
//   node --env-file=.env --env-file=.env.server scripts/revisar-verificaciones.mjs
//   node --env-file=.env --env-file=.env.server scripts/revisar-verificaciones.mjs --aprobar <usuario_id> <rol>
//   node --env-file=.env --env-file=.env.server scripts/revisar-verificaciones.mjs --rechazar <usuario_id> <rol> "<motivo>"

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supabase = createClient(url, clave, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const valorDe = (bandera) => {
  const i = args.indexOf(bandera);
  return i === -1 ? null : args.slice(i + 1);
};

async function adminResponsable() {
  const indicado = valorDe('--admin')?.[0];
  if (indicado) return indicado;
  const { data, error } = await supabase
    .from('roles_usuario').select('usuario_id').eq('rol', 'admin').eq('estado', 'aprobado').limit(2);
  if (error) throw error;
  if (!data?.length) throw new Error('No hay ningún admin aprobado en roles_usuario.');
  if (data.length > 1) throw new Error('Hay varios admins: indica uno con --admin <uuid>.');
  return data[0].usuario_id;
}

const aprobar = valorDe('--aprobar');
const rechazar = valorDe('--rechazar');

if (aprobar || rechazar) {
  const [usuario, rol, motivo] = aprobar ?? rechazar;
  if (!usuario || !rol) {
    console.error('Faltan <usuario_id> y <rol>.');
    process.exit(1);
  }
  if (rechazar && !motivo?.trim()) {
    console.error('Un rechazo exige motivo entre comillas.');
    process.exit(1);
  }
  const admin = await adminResponsable();
  const { error } = await supabase.rpc('resolver_verificacion', {
    p_usuario: usuario, p_rol: rol, p_aprobar: Boolean(aprobar), p_motivo: motivo ?? null, p_admin: admin,
  });
  if (error) {
    console.error(`No se pudo resolver (${error.code ?? 'sin código'}): ${error.message}`);
    process.exit(1);
  }
  console.log(aprobar ? 'Aprobada. La INE se borrará a los 30 días.' : 'Rechazada, con su motivo.');
  process.exit(0);
}

// ── Listado de pendientes ───────────────────────────────────────────────────
const { data: pendientes, error: errPend } = await supabase
  .from('roles_usuario').select('usuario_id, rol, desde').eq('estado', 'pendiente').in('rol', ['comerciante', 'arrendador']);
if (errPend) throw errPend;

if (!pendientes?.length) {
  console.log('No hay verificaciones pendientes.');
  process.exit(0);
}

// Verificación de rostro (0056): una AYUDA, nunca una decisión. Solo el servicio lee esta tabla; la persona no ve estas cifras.
const LECTURA = {
  coincide: 'COINCIDE: la selfie y la foto de la INE parecen la misma persona y la selfie parece una cara viva.',
  no_coincide: 'NO COINCIDE: la selfie no se parece lo bastante a la foto de la INE. Mira las fotos tú: una INE vieja o con reflejos también da esto.',
  no_vivo: 'NO PARECE VIVA: la selfie pudo ser una foto de otra pantalla o papel, o salió mal. Pide revisar con cuidado.',
  repetir_selfie: 'SIN RESULTADO: las selfies enviadas no se pudieron medir. No es una señal contra la persona.',
  sin_rostro_ine: 'SIN ROSTRO EN LA INE: no se detectó la cara en la foto del frente. Revisa la foto tú.',
  pendiente_de_foto: 'RESERVADO: se reservó un intento pero no hay resultado (fallo del servicio o la persona no terminó).',
};

async function lineasDeRostro(usuarioId, rol) {
  const { data: b, error } = await supabase
    .from('verificaciones_biometria').select('*').eq('usuario_id', usuarioId).eq('rol', rol).maybeSingle();
  if (error) return [`Rostro       : (no se pudo leer: ${error.code ?? error.message})`];
  if (!b) return ['Rostro       : la persona no hizo la comparación (es opcional). Decide solo con los documentos.'];
  return [
    `Rostro       : ${LECTURA[b.estado] ?? b.estado}`,
    `               identidad ${b.identidad ?? '—'} (umbral 0.30) · vida ${b.vivo ?? '—'} (umbral 0.90) · modelo ${b.modelo ?? '—'} · intentos ${b.intentos}/5`,
    `               consentimiento biométrico: ${b.consentimiento_en} (aviso ${b.version_aviso})`,
    '               AYUDA, no decisión: umbrales sin calibrar con estudiantes; en pruebas ~1 de cada 3 selfies reales pide repetir.',
  ];
}

for (const p of pendientes) {
  const { data: v, error } = await supabase
    .from('verificaciones_vendedor').select('*').eq('usuario_id', p.usuario_id).eq('rol', p.rol).maybeSingle();
  if (error) throw error;
  if (!v) { console.log(`\n${p.usuario_id} · ${p.rol}: pendiente pero SIN fila de evidencia (revisar a mano).`); continue; }

  const rutas = [v.ine_frente, v.ine_reverso, ...v.fotos];
  const { data: firmadas, error: errFirma } = await supabase.storage.from('verificacion').createSignedUrls(rutas, 600);
  if (errFirma) throw errFirma;
  const enlace = (ruta) => firmadas.find((f) => f.path === ruta)?.signedUrl ?? '(no disponible)';

  console.log(`\n── ${p.rol.toUpperCase()} · ${v.usuario_id}`);
  console.log(`Nombre legal : ${v.nombre_legal}`);
  console.log(`Dirección    : ${v.direccion}`);
  console.log(`Enviada      : ${v.enviada_en}   (aviso ${v.version_aviso}, consentimiento ${v.consentimiento_en})`);
  console.log(`INE frente   : ${enlace(v.ine_frente)}`);
  console.log(`INE reverso  : ${enlace(v.ine_reverso)}`);
  v.fotos.forEach((f, i) => console.log(`Foto ${i + 1}       : ${enlace(f)}`));
  for (const linea of await lineasDeRostro(v.usuario_id, p.rol)) console.log(linea);
  console.log(`→ aprobar : --aprobar ${v.usuario_id} ${p.rol}`);
  console.log(`→ rechazar: --rechazar ${v.usuario_id} ${p.rol} "<motivo>"`);
}
