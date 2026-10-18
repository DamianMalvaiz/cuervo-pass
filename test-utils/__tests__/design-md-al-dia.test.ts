import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// DESIGN.md al día · Cuervo 360.
//
// El defecto más caro de este repositorio ha sido un documento que describe un sistema más terminado que el
// construido. DESIGN.md declara los colores en su cabecera; si `theme.ts` cambia y la cabecera no, el
// documento miente en silencio. Este guardián compara los dos en AMBOS sentidos: no falta ningún color
// del tema en el documento, y el documento no conserva ninguno que el tema ya no tiene (el ámbar anterior
// habría sobrevivido meses así).

const tema = readFileSync('src/constants/theme.ts', 'utf8');
const diseno = readFileSync('DESIGN.md', 'utf8');

const HEX = /'(#[0-9a-fA-F]{6})'/g;

/** Los hex del bloque `Colors` (los dos modos) y de `AppColors`. */
function coloresDelTema(): Set<string> {
  const i = tema.indexOf('export const Colors = {');
  const j = tema.indexOf('export type ThemeColor');
  const k = tema.indexOf('export const AppColors = {');
  const l = tema.indexOf('} as const;', k);
  const bloques = tema.slice(i, j) + tema.slice(k, l);
  // Los comentarios con un hex entre comillas (`'#E8A33D'`) no son valores: se descartan las líneas de comentario.
  const sinComentarios = bloques
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  return new Set([...sinComentarios.matchAll(HEX)].map((m) => m[1].toUpperCase()));
}

/** Los hex de la sección `colors:` de la cabecera YAML de DESIGN.md. */
function coloresDelDocumento(): Set<string> {
  const cabecera = diseno.split(/^---$/m)[1];
  const a = cabecera.indexOf('colors:');
  const b = cabecera.indexOf('typography:');
  return new Set([...cabecera.slice(a, b).matchAll(/"(#[0-9a-fA-F]{6})"/g)].map((m) => m[1].toUpperCase()));
}

test('el documento se llama Cuervo 360', () => {
  expect(diseno.split(/^---$/m)[1]).toMatch(/^name: Cuervo 360$/m);
});

test('todo color del tema está declarado en DESIGN.md', () => {
  const doc = coloresDelDocumento();
  const faltan = [...coloresDelTema()].filter((c) => !doc.has(c));
  expect(faltan).toEqual([]);
});

test('DESIGN.md no conserva colores que el tema ya no tiene', () => {
  const t = coloresDelTema();
  const sobran = [...coloresDelDocumento()].filter((c) => !t.has(c));
  expect(sobran).toEqual([]);
});

test('el ámbar anterior ya no es un color vigente del sistema', () => {
  expect(coloresDelDocumento().has('#E8A33D')).toBe(false);
});

// «Los dos números se cuentan, no se recuerdan»: se cuentan aquí también.
const contar = (raiz: string, excluirLayout: boolean): number => {
  let n = 0;
  for (const nombre of readdirSync(raiz)) {
    const ruta = join(raiz, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre !== '__tests__') n += contar(ruta, excluirLayout);
    } else if (nombre.endsWith('.tsx') && !(excluirLayout && nombre === '_layout.tsx')) n += 1;
  }
  return n;
};

test('los conteos de pantallas y componentes del final son los reales', () => {
  const pantallas = Number(/\*\*(\d+)\s+pantallas\*\*/.exec(diseno)?.[1]);
  const componentes = Number(/\*\*(\d+)\s+componentes\*\*/.exec(diseno)?.[1]);
  expect(pantallas).toBe(contar('src/app', true));
  expect(componentes).toBe(contar('src/components', false));
});
