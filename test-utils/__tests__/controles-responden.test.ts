import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// «Respuesta»: un control debe contestar en el instante en que se toca, no al soltar. Medido el 24/10/2026: de 25 archivos con `<Pressable>` crudo, 16 no
// daban NINGUNA señal visual al toque (el selector de módulos, la casilla, el ojo de la contraseña, 6 controles de publicar, «Ver contacto»…). Lo escrito en
// un documento se olvida, así que esta prueba lo comprueba: cada `<Pressable>` crudo o trae su propio estilo `pressed`, o se pasa a `Pulsable` (escala y
// opacidad, y respeta «reducir movimiento»), o lleva la exención con su MOTIVO en la línea anterior:
//
//   // respuesta-ok: la burbuja solo es tocable si falló el envío; encogerla siempre sería mentir
//
// Una exención que obliga a escribir el porqué es una decisión; una que se activa sola es un agujero.

const RAIZ = join(__dirname, '..', '..', 'src');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === '__tests__' ? [] : archivos(ruta);
    return ruta.endsWith('.tsx') ? [ruta] : [];
  });
}

/** Cuántos renglones hacia delante se busca `pressed`: el estilo del propio control, no el de otro cercano. */
const VENTANA = 14;

describe('todo control responde al toque', () => {
  const infractores: string[] = [];
  for (const ruta of archivos(RAIZ)) {
    const lineas = readFileSync(ruta, 'utf8').split('\n');
    lineas.forEach((linea, i) => {
      if (!/<Pressable(\s|>|$)/.test(linea)) return;
      const propio = lineas.slice(i, i + VENTANA).join('\n').includes('pressed');
      const exento = /respuesta-ok:\s*\S+/.test(lineas[i - 1] ?? '');
      if (!propio && !exento) infractores.push(`${relative(RAIZ, ruta)}:${i + 1}`);
    });
  }

  it('ningún <Pressable> crudo queda sin respuesta ni exención con motivo', () => {
    expect(infractores).toEqual([]);
  });
});
