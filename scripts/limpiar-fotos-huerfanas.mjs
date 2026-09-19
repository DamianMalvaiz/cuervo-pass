#!/usr/bin/env node
//
// Vacía la cola `fotos_huerfanas`.
//
//   node --env-file=.env scripts/limpiar-fotos-huerfanas.mjs
//
// Por qué hay una cola y no un borrado directo: hasta la migración 0021, el
// trigger `trg_limpiar_fotos` hacía `delete from storage.objects`. Supabase
// añadió después una barrera que lo prohíbe, el trigger reventaba, y con él la
// transacción entera — así que "Eliminar mi cuenta" devolvía error para
// cualquiera que hubiera subido una foto.
//
// Ahora el trigger solo deja constancia de lo que hay que borrar, y borrarlo de
// verdad es trabajo de quien puede hablar con la Storage API. La función
// `eliminar-cuenta` lo hace en el momento; esto recoge lo que se le escape.
//
// La cola es una DEUDA VISIBLE: mientras tenga filas, hay archivos que alguien
// creyó borrados y siguen ocupando espacio que se paga. `scripts/verificar.mjs`
// la mira antes de cada demo por esa razón.

import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: cola, error } = await admin.from('fotos_huerfanas').select('ruta').limit(1000);
if (error) {
  console.error('No se pudo leer la cola:', error.message);
  process.exit(1);
}

if (cola.length === 0) {
  console.log('\n  La cola está vacía. Nada que barrer.\n');
  process.exit(0);
}

console.log(`\n  ${cola.length} ruta(s) en la cola.\n`);
const rutas = cola.map((c) => c.ruta);

const { error: eStorage } = await admin.storage.from('fotos').remove(rutas);
if (eStorage) {
  console.error('  Storage rechazó el borrado:', eStorage.message);
  console.error('  Las filas se dejan en la cola para reintentarlo.\n');
  process.exit(1);
}

// Solo se quitan de la cola DESPUÉS de que Storage confirme. Al revés, un fallo
// del almacenamiento borraría el único registro de que esos archivos existen.
const { error: eCola } = await admin.from('fotos_huerfanas').delete().in('ruta', rutas);
if (eCola) {
  console.error('  Los archivos se borraron pero la cola no se pudo vaciar:', eCola.message);
  console.error('  Volver a correr esto es inofensivo: Storage ignora lo que ya no existe.\n');
  process.exit(1);
}

console.log(`  ${rutas.length} archivo(s) eliminados y la cola vaciada.\n`);
