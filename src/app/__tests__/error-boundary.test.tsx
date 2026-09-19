import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

// END-12 · Sin red de seguridad, un error de render en release es PANTALLA
// BLANCA: sin traza, sin mensaje, sin salida, en vivo. El principio #1 de
// PRODUCT.md es «Reliability over features», y ése era el modo de fallo más
// visible que tenía la app.
//
// expo-router reconoce un `ErrorBoundary` exportado desde un layout por su
// NOMBRE y lo pinta EN LUGAR del subárbol que reventó — no lo envuelve, así que
// no recibe hijos. Una primera versión de estas pruebas le pasaba `children` e
// inventaba un contrato que el framework no tiene; se corrigió contra la firma
// real en vez de adaptar el componente a la prueba.

import { ErrorBoundary } from '../_layout';
import { registrarSumidero, type Evento } from '@/lib/registro';

let compartido: string | undefined;
beforeEach(() => {
  compartido = undefined;
  jest.spyOn(Share, 'share').mockImplementation(async (c) => {
    compartido = (c as { message?: string }).message;
    return { action: 'sharedAction' } as never;
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// LA prueba: nunca una pantalla en blanco.
test('con un error, muestra el fallo en vez de nada', async () => {
  await render(<ErrorBoundary error={new Error('el motor devolvió humo')} retry={jest.fn()} />);
  expect(screen.getByText('ALGO SE ROMPIÓ')).toBeTruthy();
  expect(screen.getByText('el motor devolvió humo')).toBeTruthy();
});

// Un error sin salida deja la app muerta hasta que se mate el proceso. Quien
// está enseñando la app no puede hacer eso delante de nadie.
test('ofrece reintentar, y reintentar llama a retry', async () => {
  const retry = jest.fn();
  await render(<ErrorBoundary error={new Error('x')} retry={retry} />);
  fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(retry).toHaveBeenCalled();
});

test('ofrece compartir el detalle, con la traza incluida', async () => {
  const e = new Error('detalle que importa');
  await render(<ErrorBoundary error={e} retry={jest.fn()} />);
  fireEvent.press(screen.getByLabelText('Compartir detalle'));
  expect(compartido).toContain('detalle que importa');
});

// §29 · lo que sale del dispositivo va limpio. Un reporte de error es donde más
// se filtra: viaja entero y nadie lo lee antes.
test('lo compartido no lleva correos en claro', async () => {
  await render(
    <ErrorBoundary error={new Error('falló al escribir a ana@utvt.edu.mx')} retry={jest.fn()} />
  );
  fireEvent.press(screen.getByLabelText('Compartir detalle'));
  expect(compartido).toContain('[correo]');
  expect(compartido).not.toContain('ana@utvt.edu.mx');
});

// Un error sin mensaje no puede dejar el recuadro vacío: eso se lee igual que
// la pantalla blanca que esto viene a eliminar.
test('un error sin mensaje sigue diciendo algo', async () => {
  await render(<ErrorBoundary error={new Error('')} retry={jest.fn()} />);
  expect(screen.getByText('ALGO SE ROMPIÓ')).toBeTruthy();
  expect(screen.getByText('sin detalle')).toBeTruthy();
});

// El fallo tiene que quedar registrado, no solo pintado: en release la consola
// no existe y sin esto no quedaría rastro de nada.
test('el error se registra, no solo se muestra', async () => {
  const vistos: Evento[] = [];
  const quitar = registrarSumidero((e) => vistos.push(e));
  await render(<ErrorBoundary error={new Error('humo')} retry={jest.fn()} />);
  expect(vistos.some((e) => e.nivel === 'error')).toBe(true);
  quitar();
});
