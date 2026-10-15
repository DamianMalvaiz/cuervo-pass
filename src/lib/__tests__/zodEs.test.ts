// Mensajes de validación en español.
//
// El defecto: un campo que nunca se tocó vale `undefined`, y Zod 4 responde con su
// mensaje genérico en INGLÉS —«Invalid input: expected string, received
// undefined»—, que es lo que la persona leía bajo cada campo vacío. Un campo
// vacío con texto (`''`) sí daba el mensaje en español del esquema; la diferencia
// entre «sin tocar» y «tocado y borrado» no tiene por qué ser visible.
//
// La corrección es global y no por campo: cinco formularios definen esquemas y
// ninguno daba valores iniciales a sus textos.

import { z } from 'zod';

import { MENSAJE_OBLIGATORIO } from '../zodEs';

const mensajes = (esquema: z.ZodType, valor: unknown) => {
  const r = esquema.safeParse(valor);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

const enIngles = /invalid input|expected|received|too small|too big|required/i;

test('un texto sin tocar dice que es obligatorio, en español', () => {
  expect(mensajes(z.object({ titulo: z.string() }), {})).toEqual([MENSAJE_OBLIGATORIO]);
});

test('un booleano o una opción sin tocar también', () => {
  const esquema = z.object({ acepto: z.boolean(), tipo: z.enum(['a', 'b']) });
  expect(mensajes(esquema, {})).toEqual([MENSAJE_OBLIGATORIO, MENSAJE_OBLIGATORIO]);
});

// `null` es otra forma de «no hay valor»: llega de campos que se limpian.
test('null cuenta igual que undefined', () => {
  expect(mensajes(z.object({ titulo: z.string() }), { titulo: null })).toEqual([MENSAJE_OBLIGATORIO]);
});

// El mensaje propio de cada campo MANDA sobre el genérico: la configuración global
// no puede pisar «Escribe la calle».
test('un mensaje propio del esquema no se pisa', () => {
  expect(mensajes(z.object({ calle: z.string('Escribe la calle') }), {})).toEqual(['Escribe la calle']);
  expect(mensajes(z.object({ calle: z.string().min(3, 'Escribe la calle') }), { calle: 'ab' })).toEqual([
    'Escribe la calle',
  ]);
});

// Lo que NO tiene mensaje propio cae a la traducción de Zod, no al inglés.
test('un esquema sin mensaje propio no sale en inglés', () => {
  const esquema = z.object({
    corto: z.string().min(3),
    numero: z.number(),
    correo: z.string().email(),
    codigo: z.string().regex(/^\d+$/),
  });
  const todos = mensajes(esquema, { corto: 'ab', numero: 'x', correo: 'no', codigo: 'x' });

  expect(todos).toHaveLength(4);
  for (const m of todos) expect(m).not.toMatch(enIngles);
});

test('el mensaje de obligatorio está en español', () => {
  expect(MENSAJE_OBLIGATORIO).toBe('Este campo es obligatorio');
});
