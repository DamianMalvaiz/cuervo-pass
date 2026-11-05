import { readFileSync } from 'node:fs';

// Guardas estáticas de `admin/index.ts` (no hay Deno aquí). La acción `salud` consulta el servicio de IA desde el servidor: lo que no puede pasar es que la respuesta
// al navegador lleve la URL del túnel o el token, ni que la consulta pueda colgar la función.
const fuente = readFileSync('supabase/functions/admin/index.ts', 'utf8');
const bloqueSalud = fuente.slice(fuente.indexOf("case 'salud'"), fuente.indexOf("case 'eventos_pago'"));

test('la acción «salud» existe y usa la política', () => {
  expect(bloqueSalud.length).toBeGreaterThan(50);
  expect(bloqueSalud).toContain('interpretarSaludIa(');
});

test('la consulta al servicio de IA tiene tiempo máximo y no manda ningún token', () => {
  expect(bloqueSalud).toMatch(/AbortSignal\.timeout\(\d+/);
  expect(fuente).not.toContain('AI_SHARED_TOKEN');
  expect(bloqueSalud).not.toMatch(/Authorization/i);
});

test('lo que se devuelve al navegador no incluye la URL del servicio', () => {
  const retorno = bloqueSalud.slice(bloqueSalud.indexOf('return json('));
  expect(retorno).not.toMatch(/\burl\b|AI_SERVICE_URL/);
});

test('de Mercado Pago solo se dice si las credenciales están: cada lectura va DENTRO de un Boolean(...), nunca su valor', () => {
  const lecturas = bloqueSalud.match(/Deno\.env\.get\('MP_[A-Z_]+'\)/g) ?? [];
  expect(lecturas.length).toBeGreaterThan(0);
  // Se quitan las llamadas a Boolean(...) con todo lo de dentro: si queda alguna lectura de MP_*, se estaba devolviendo el valor.
  const sinBooleanos = bloqueSalud.replace(/Boolean\((?:[^()]|\([^()]*\))*\)/g, '');
  expect(sinBooleanos).not.toMatch(/Deno\.env\.get\('MP_/);
});

test('«eventos_pago» lee por la función de la base (que vuelve a comprobar admin)', () => {
  expect(fuente).toMatch(/rpc\('admin_eventos_pago',\s*\{\s*p_admin:\s*admin\s*\}\)/);
});
