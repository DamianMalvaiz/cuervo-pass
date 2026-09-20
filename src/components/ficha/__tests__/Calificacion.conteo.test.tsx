// END-37 · El conteo de la cifra, y las dos cosas que no puede hacer mal:
// empezar en el numero final (entonces no cuenta) y no llegar a el (entonces
// miente sobre el resultado).

import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { Calificacion } from '../Calificacion';

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
});
afterEach(() => jest.restoreAllMocks());

// Sin `animada` la cifra sale puesta. Es el caso de la LISTA: treinta numeros
// contando a la vez serian ilegibles, y sugeririan treinta calculos que no
// estan ocurriendo.
test('sin animar, la cifra aparece ya en su valor', async () => {
  await render(<Calificacion score={0.87} />);
  expect(screen.getByText('8.5')).toBeTruthy();
});

// Con `animada`, el primer cuadro es cero: de ahi sube. Si esta asercion
// empezara a ver «8.5» significaria que el conteo dejo de contar, que es un
// fallo invisible a simple vista en un dispositivo rapido.
//
// EL RELOJ SE CONGELA. La primera version de esta prueba solo comprobaba el
// texto tras `render` y daba verde porque ningun cuadro habia corrido todavia:
// al actualizar React empezaron a correr dos o tres y la prueba leyo «3.7».
// No fallaba el conteo, fallaba la prueba — dependia de cuantos cuadros cupieran
// antes de la asercion, que es justo el tipo de fragilidad que E.2 vino a quitar
// de esta suite. Con `Date.now` fijo, el progreso es 0 pase lo que pase.
test('animada, arranca en cero', async () => {
  const t0 = 1_000_000;
  const reloj = jest.spyOn(Date, 'now').mockReturnValue(t0);
  const vista = await render(<Calificacion score={0.87} tamano="ficha" animada />);
  expect(screen.getByText('0.0')).toBeTruthy();
  vista.unmount();
  reloj.mockRestore();
});

// Y llega. Un conteo que arranca en cero y se queda a medias miente sobre el
// resultado, que es peor que no contar. Se adelanta el reloj mas alla de la
// duracion y se espera al cuadro siguiente.
test('animada, termina en el valor final', async () => {
  const t0 = 2_000_000;
  const reloj = jest.spyOn(Date, 'now').mockReturnValue(t0);
  const vista = await render(<Calificacion score={0.87} tamano="ficha" animada />);
  reloj.mockReturnValue(t0 + 5_000);
  expect(await screen.findByText('8.5')).toBeTruthy();
  vista.unmount();
  reloj.mockRestore();
});

// Quien pidio no ver movimiento ve el numero final desde el primer cuadro. No
// una version acelerada del conteo: NINGUN conteo.
test('con movimiento reducido no hay conteo, hay numero', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await render(<Calificacion score={0.87} tamano="ficha" animada />);
  expect(await screen.findByText('8.5')).toBeTruthy();
});

// El lector de pantalla recibe el valor FINAL aunque la cifra este subiendo.
// Recitar veinticuatro numeros en 400 ms no informaria de nada, y el dato que
// importa es al que llega.
test('la etiqueta accesible lleva el valor final, no el del conteo', async () => {
  await render(<Calificacion score={0.87} tamano="ficha" animada />);
  expect(screen.getByLabelText('ajuste 8.5 de 10')).toBeTruthy();
});
