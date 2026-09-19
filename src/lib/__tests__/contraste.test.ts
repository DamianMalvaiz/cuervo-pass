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
  expect(salida).toContain('lámpara (oscuro)');
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
