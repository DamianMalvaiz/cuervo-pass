import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// El fallo más común al configurar Firebase es que el nombre de paquete del `google-services.json` no coincida con el de la app («No matching client found for package name»), y solo se descubre
// tras esperar un build entero. Este verificador lo comprueba en un segundo, y NUNCA imprime una clave de API.

const CLI = 'scripts/verificar-google-services.mjs';
const PAQUETE = 'mx.cuervopass.app';
// Inventada, y armada en dos partes a propósito: escrita entera tiene la forma de una clave de Google y gitleaks la marca (falso positivo) en cada escaneo.
const CLAVE = ['AIza', 'SyFAKEKEYfakekeyFAKEKEYfakekey12345'].join('');

function correr(contenido: string | null) {
  const dir = mkdtempSync(join(tmpdir(), 'gs-'));
  const ruta = join(dir, 'google-services.json');
  if (contenido !== null) writeFileSync(ruta, contenido);
  try {
    return { codigo: 0, salida: execFileSync('node', [CLI, ruta], { encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    const x = e as { status?: number; stdout?: string; stderr?: string };
    return { codigo: x.status ?? -1, salida: `${x.stdout ?? ''}${x.stderr ?? ''}` };
  }
}

const bueno = (paquete = PAQUETE) =>
  JSON.stringify({
    project_info: { project_id: 'cuervo-360-demo', project_number: '123' },
    client: [{ client_info: { mobilesdk_app_id: '1:1:android:abc', android_client_info: { package_name: paquete } }, api_key: [{ current_key: CLAVE }] }],
  });

test('un archivo correcto pasa, dice de qué proyecto es y NO imprime la clave', () => {
  const r = correr(bueno());
  expect(r.codigo).toBe(0);
  expect(r.salida).toContain('cuervo-360-demo');
  expect(r.salida).toContain(PAQUETE);
  expect(r.salida).not.toContain('AIza');
});

test('un paquete distinto falla y dice cuál se esperaba y cuál trae', () => {
  const r = correr(bueno('com.otra.app'));
  expect(r.codigo).toBe(1);
  expect(r.salida).toContain(PAQUETE);
  expect(r.salida).toContain('com.otra.app');
  expect(r.salida).not.toContain('AIza');
});

test('si el archivo trae varias apps, basta con que una sea la nuestra', () => {
  const doble = JSON.stringify({
    project_info: { project_id: 'p' },
    client: [
      { client_info: { android_client_info: { package_name: 'com.otra.app' } } },
      { client_info: { android_client_info: { package_name: PAQUETE } } },
    ],
  });
  const r = correr(doble);
  expect(r.codigo).toBe(0);
  expect(r.salida).toContain('OK:');
});

test.each([
  ['JSON inválido', '{no es json'],
  ['sin project_id', JSON.stringify({ project_info: {}, client: [{ client_info: { android_client_info: { package_name: PAQUETE } } }] })],
  ['sin clientes', JSON.stringify({ project_info: { project_id: 'p' }, client: [] })],
  ['una forma que no es objeto', '[]'],
])('%s falla, y por el motivo correcto', (_nombre, contenido) => {
  const r = correr(contenido);
  expect(r.codigo).toBe(1);
  // Sin mirar el texto, un script que NO EXISTE también «falla» con código 1 y la prueba pasaría por el motivo equivocado.
  expect(r.salida).toContain('FALLA:');
});

test('si el archivo no existe falla y lo dice (no se asume nada)', () => {
  const r = correr(null);
  expect(r.codigo).toBe(1);
  expect(r.salida).toMatch(/no existe|no se pudo leer/i);
});
