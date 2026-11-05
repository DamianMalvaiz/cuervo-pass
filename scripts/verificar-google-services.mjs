#!/usr/bin/env node
// Comprueba un `google-services.json` ANTES de gastar un build: que sea JSON, que traiga el proyecto y que alguna de sus apps tenga el nombre de paquete de ESTA app (el de `app.json`).
// Nunca imprime una clave de API. Uso: node scripts/verificar-google-services.mjs [ruta]   (por omisión ./google-services.json)
import { readFileSync } from 'node:fs';

const ruta = process.argv[2] ?? './google-services.json';
const esperado = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo.android.package;
const falla = (texto) => {
  console.error(`FALLA: ${texto}`);
  process.exit(1);
};

let datos;
try {
  datos = JSON.parse(readFileSync(ruta, 'utf8'));
} catch (e) {
  falla(e?.code === 'ENOENT' ? `el archivo no existe: ${ruta}` : `no se pudo leer ${ruta} como JSON.`);
}

if (!datos || typeof datos !== 'object' || Array.isArray(datos)) falla('el contenido no es un objeto JSON.');
const proyecto = datos.project_info?.project_id;
if (typeof proyecto !== 'string' || proyecto === '') falla('no trae `project_info.project_id`: no parece un google-services.json de Firebase.');
const clientes = Array.isArray(datos.client) ? datos.client : [];
const paquetes = clientes.map((c) => c?.client_info?.android_client_info?.package_name).filter((p) => typeof p === 'string');
if (paquetes.length === 0) falla('no trae ninguna app de Android (`client[].client_info.android_client_info`).');
if (!paquetes.includes(esperado)) falla(`el paquete no coincide. La app es «${esperado}» y el archivo trae: ${paquetes.join(', ')}. Registra la app de Android con el nombre exacto.`);

console.log(`OK: proyecto «${proyecto}», paquete «${esperado}».`);
