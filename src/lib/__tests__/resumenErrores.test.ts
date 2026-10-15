// Toast resumen de la validación · paso 2.
//
// Con un pie fijo y un formulario de dieciséis campos, tocar «Publicar» con un
// campo inválido no mostraba NADA a la vista: los errores aparecen en rojo bajo
// cada campo, y el campo mal puede estar fuera de pantalla. Este ayudante arma la
// frase que el toast le dice a quien tocó el botón: cuántos y cuáles.

import { resumenDeErrores } from '../resumenErrores';

// El orden de las etiquetas ES el orden de la pantalla: de ahí sale el orden de
// la frase, no del orden en que react-hook-form validó.
const ETIQUETAS = {
  titulo: 'Título',
  calle: 'Calle',
  precio: 'Precio',
  whatsapp: 'WhatsApp',
  notas: 'Notas',
};

const err = (...campos: string[]) =>
  Object.fromEntries(campos.map((c) => [c, { type: 'x', message: 'mal' }]));

test('sin errores no hay frase', () => {
  expect(resumenDeErrores({}, ETIQUETAS)).toBeNull();
});

test('un campo', () => {
  expect(resumenDeErrores(err('precio'), ETIQUETAS)).toBe('Revisa el campo: Precio');
});

test('dos campos se unen con «y»', () => {
  expect(resumenDeErrores(err('precio', 'titulo'), ETIQUETAS)).toBe('Revisa 2 campos: Título y Precio');
});

test('tres campos: comas y «y» antes del último', () => {
  expect(resumenDeErrores(err('whatsapp', 'precio', 'titulo'), ETIQUETAS)).toBe(
    'Revisa 3 campos: Título, Precio y WhatsApp'
  );
});

// Ocho campos de dirección vacíos no caben en un aviso de una línea.
test('con más de tres, nombra tres y cuenta el resto', () => {
  expect(resumenDeErrores(err('notas', 'whatsapp', 'precio', 'calle', 'titulo'), ETIQUETAS)).toBe(
    'Revisa 5 campos: Título, Calle, Precio y 2 más'
  );
});

test('con exactamente cuatro, «y 1 más»', () => {
  expect(resumenDeErrores(err('notas', 'whatsapp', 'precio', 'calle'), ETIQUETAS)).toBe(
    'Revisa 4 campos: Calle, Precio, WhatsApp y 1 más'
  );
});

// Un error de un campo que la pantalla no etiquetó no se puede esconder: se
// cuenta aunque no se pueda nombrar. Perderlo diría «revisa 1 campo» habiendo dos.
test('un campo sin etiqueta se cuenta aunque no se nombre', () => {
  expect(resumenDeErrores(err('precio', 'desconocido'), ETIQUETAS)).toBe('Revisa 2 campos: Precio y 1 más');
});

test('solo campos sin etiqueta: se cuenta sin nombrar', () => {
  expect(resumenDeErrores(err('desconocido'), ETIQUETAS)).toBe('Revisa 1 campo');
});

// Un campo con valor undefined en el objeto de errores no es un error.
test('un campo presente pero vacío en el objeto no cuenta', () => {
  expect(resumenDeErrores({ precio: undefined, titulo: { type: 'x' } }, ETIQUETAS)).toBe(
    'Revisa el campo: Título'
  );
});
