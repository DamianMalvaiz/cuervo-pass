// Mensajes de validación en español · configuración GLOBAL de Zod.
//
// El defecto que esto cierra: un campo que nunca se tocó vale `undefined`, y Zod 4
// responde con su mensaje genérico en INGLÉS —«Invalid input: expected string,
// received undefined»—, que es lo que la persona leía bajo cada campo vacío. Un
// campo con `''` sí daba el mensaje en español del esquema («Escribe la calle»): la
// diferencia entre «sin tocar» y «tocado y borrado» no tiene por qué ser visible.
//
// Es global y no por campo porque cinco formularios definen esquemas y ninguno
// daba valores iniciales a sus textos. Dárselos habría sido tocar cinco
// formularios —el de registro, además, tiene un `superRefine` que depende de
// `password` y cambiaría de comportamiento con `''`— y el siguiente formulario
// nuevo volvería a tener el defecto.
//
// ── Cómo se resuelve un mensaje, de mayor a menor prioridad ─────────────────
//   1. El mensaje propio del esquema: `z.string().min(3, 'Escribe la calle')`.
//      Verificado con Zod 4.6.5: esta configuración NO lo pisa.
//   2. `customError` de aquí: cualquier valor ausente (`undefined`/`null`) es
//      «obligatorio», sea cual sea el tipo (texto, booleano, opción).
//   3. La traducción de Zod (`z.locales.es()`), para lo que no tiene mensaje
//      propio. Es español, aunque técnico: «Demasiado pequeño: se esperaba…».
//
// Cada archivo que define un esquema la importa por efecto
// (`import '@/lib/zodEs'`), y `test-utils/__tests__/esquemas-en-espanol.test.ts`
// rompe el build si alguno no lo hace.

import { z } from 'zod';

export const MENSAJE_OBLIGATORIO = 'Este campo es obligatorio';

z.config({
  ...z.locales.es(),
  customError: (issue) =>
    issue.input === undefined || issue.input === null ? MENSAJE_OBLIGATORIO : undefined,
});
