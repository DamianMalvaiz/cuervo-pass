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
test('animada, arranca en cero', async () => {
  await render(<Calificacion score={0.87} tamano="ficha" animada />);
  expect(screen.getByText('0.0')).toBeTruthy();
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
