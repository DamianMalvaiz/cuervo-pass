import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// END-35 · Un verificador que solo se comprueba «en verde» no sirve: pasaría
// igual si no mirara nada. Estas pruebas lo ejercitan en las DOS direcciones —
// que detecte lo que debe y que no grite por lo que no—, que es la lección que
// dejó `verificar-env.mjs` en END-04.

const correr = (cwd: string) => {
  try {
    execFileSync('node', [join(process.cwd(), 'scripts/verificar-toques.mjs')], { cwd, encoding: 'utf8' });
    return { codigo: 0, salida: '' };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { codigo: err.status ?? 1, salida: (err.stdout ?? '') + (err.stderr ?? '') };
  }
};

const conArchivo = (contenido: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'toques-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'Prueba.tsx'), contenido);
  return dir;
};

test('el arbol real no tiene ningun control por debajo de 44', () => {
  expect(correr(process.cwd()).codigo).toBe(0);
});

test('detecta un boton por debajo del minimo', () => {
  const dir = conArchivo("const e = { botonChico: { minHeight: 30 } };\n");
  const { codigo, salida } = correr(dir);
  expect(codigo).toBe(1);
  expect(salida).toContain('botonChico');
  rmSync(dir, { recursive: true, force: true });
});

test('detecta `height` ademas de `minHeight`', () => {
  const dir = conArchivo("const e = { accionCerrar: { height: 24 } };\n");
  expect(correr(dir).codigo).toBe(1);
  rmSync(dir, { recursive: true, force: true });
});

test('acepta la exencion cuando lleva su motivo escrito', () => {
  const dir = conArchivo(
    "const e = {\n  botonChico: {\n    // toque-ok: hitSlop de 12 lo lleva a 44\n    minHeight: 20,\n  },\n};\n"
  );
  expect(correr(dir).codigo).toBe(0);
  rmSync(dir, { recursive: true, force: true });
});

// Un comentario cualquiera NO exime: la exención tiene que ser explícita, o
// deja de ser una decisión y se vuelve un agujero.
test('un comentario que no es la exencion no exime', () => {
  const dir = conArchivo(
    "const e = {\n  botonChico: {\n    // es chiquito porque si\n    minHeight: 20,\n  },\n};\n"
  );
  expect(correr(dir).codigo).toBe(1);
  rmSync(dir, { recursive: true, force: true });
});

// No todo lo que tiene altura es tocable. Una tarjeta de 40 px no es un
// problema; marcarla seria ruido, y un verificador ruidoso se acaba apagando.
test('no se queja de estilos que no son controles', () => {
  const dir = conArchivo("const e = { tarjeta: { minHeight: 40 }, separador: { height: 1 } };\n");
  expect(correr(dir).codigo).toBe(0);
  rmSync(dir, { recursive: true, force: true });
});

test('ignora las pruebas, que no son interfaz', () => {
  const dir = mkdtempSync(join(tmpdir(), 'toques-'));
  mkdirSync(join(dir, 'src', '__tests__'), { recursive: true });
  writeFileSync(join(dir, 'src', '__tests__', 'x.tsx'), "const e = { botonChico: { minHeight: 10 } };\n");
  expect(correr(dir).codigo).toBe(0);
  rmSync(dir, { recursive: true, force: true });
});
