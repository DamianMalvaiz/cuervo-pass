import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// «Feedback»: un error de un campo se dice cuando la persona SALE del campo, no horas después, al pulsar «Enviar». Con `useForm` sin `mode`, React Hook
// Form valida solo al enviar: quien se equivoca en el correo lo descubre después de esperar. `onTouched` valida al salir del campo y, desde entonces, al
// cambiar. Medido el 24/10/2026: los cinco formularios de la app lo hacían al enviar. Cada `useForm<` declara su modo o lleva la exención con su motivo:
//
//   // validacion-ok: es un formulario de un solo botón; no hay campo que corregir antes de enviar

const RAIZ = join(__dirname, '..', '..', 'src');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === '__tests__' ? [] : archivos(ruta);
    return ruta.endsWith('.tsx') ? [ruta] : [];
  });
}

describe('todo formulario valida al salir del campo', () => {
  const infractores: string[] = [];
  for (const ruta of archivos(RAIZ)) {
    const lineas = readFileSync(ruta, 'utf8').split('\n');
    lineas.forEach((linea, i) => {
      if (!/\buseForm</.test(linea)) return;
      const llamada = lineas.slice(i, i + 8).join('\n');
      const conModo = /mode:\s*'onTouched'/.test(llamada);
      const exento = /validacion-ok:\s*\S+/.test(lineas[i - 1] ?? '');
      if (!conModo && !exento) infractores.push(`${relative(RAIZ, ruta)}:${i + 1}`);
    });
  }

  it('ningún useForm queda en el modo por omisión (validar solo al enviar) sin exención con motivo', () => {
    expect(infractores).toEqual([]);
  });
});
