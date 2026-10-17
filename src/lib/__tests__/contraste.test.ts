import { execFileSync } from 'node:child_process';

// END-29 · La prueba EJECUTA el verificador, en vez de importar su fórmula.
//
// Se intentó importarla —para no duplicarla— y jest no transforma `.mjs` sin
// reconfigurar el preset entero; el intento dejó `.ts` y `.tsx` sin transformar
// y tumbó toda la suite. Ejecutarlo tiene además una ventaja sobre importarlo:
// comprueba exactamente lo que va a comprobar CI, incluido el código de salida,
// que es lo que hace de esto una compuerta y no una anotación.

const correr = () => {
  try {
    return { salida: execFileSync('node', ['scripts/verificar-contraste.mjs'], { encoding: 'utf8' }), codigo: 0 };
  } catch (e) {
    const err = e as { stdout?: string; status?: number };
    return { salida: err.stdout ?? '', codigo: err.status ?? 1 };
  }
};

test('el tema actual cumple todos los mínimos declarados', () => {
  const { salida, codigo } = correr();
  expect(salida).not.toMatch(/FALLA/);
  expect(codigo).toBe(0);
});

test('mide los dos modos, no solo el claro', () => {
  const { salida } = correr();
  expect(salida).toContain('papel (claro)');
  expect(salida).toContain('tinta (oscuro)');
});

// El par que delató END-29. Que siga apareciendo en la salida es lo que impide
// que alguien lo borre de la lista en vez de corregir el color.
test('el lavado del sello se sigue midiendo contra el fondo', () => {
  const { salida } = correr();
  expect(salida).toMatch(/tintedSurface \/ background/);
});

test('mide superficie contra superficie, que es lo que faltaba', () => {
  const { salida } = correr();
  expect(salida).toMatch(/backgroundSelected \/ background/);
  expect(salida).toMatch(/backgroundElement \/ background/);
});

// ── Cuervo 360 · paleta nueva ─────────────────────────────────────────────────
// Verde lima #A5D83E es SOLO relleno: sobre blanco da 1.68:1 y no sirve para texto
// ni iconos. Por eso el verificador mide lo que SÍ se hace con él —el texto
// carbón encima— y el verde bosque como control (icono, botón secundario).

test('mide el texto carbón sobre el relleno lima, en los dos modos', () => {
  const { salida } = correr();
  expect(salida.match(/limaTexto \/ lima/g)?.length).toBe(2);
});

test('mide el verde bosque como control sobre el fondo y sobre la tarjeta', () => {
  const { salida } = correr();
  expect(salida.match(/bosque \/ background\b/g)?.length).toBe(2);
  expect(salida.match(/bosque \/ backgroundElement/g)?.length).toBe(2);
});

test('el tema trae la paleta de Cuervo 360', () => {
  const tema = require('node:fs').readFileSync('src/constants/theme.ts', 'utf8') as string;
  // Carbón como fondo del modo oscuro, y el fondo de pantalla claro que distingue las tarjetas blancas.
  expect(tema).toMatch(/background: '#171A18'/);
  expect(tema).toMatch(/background: '#F4F6F2'/);
  expect(tema).toMatch(/lima: '#A5D83E'/);
  expect(tema).toMatch(/bosque: '#477451'/);
});

// El sello (carbón con texto lima en claro, blanco hueso con texto carbón en oscuro) y el
// texto sobre el verde bosque (casilla marcada, insignia de cámara) también se miden.
test('mide el texto del sello sobre el sello, y el texto sobre el bosque, en los dos modos', () => {
  const { salida } = correr();
  expect(salida.match(/selloTexto \/ sello/g)?.length).toBe(2);
  expect(salida.match(/bosqueTexto \/ bosque/g)?.length).toBe(2);
});
