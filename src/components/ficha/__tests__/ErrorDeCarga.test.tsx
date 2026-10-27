import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ErrorDeCarga } from '../ErrorDeCarga';

// «Falló la conexión» y «no hay datos» son estados DISTINTOS (END-11). Este bloque es el primero: dice qué no se pudo leer y ofrece reintentar.

test('dice qué no se pudo cargar y ofrece reintentar', async () => {
  const reintentar = jest.fn();
  await render(<ErrorDeCarga etiqueta="No pudimos cargar tu perfil" onReintentar={reintentar} />);
  expect(screen.getByText('No pudimos cargar tu perfil')).toBeTruthy();
  expect(screen.getByText(/Revisa tu conexión/)).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByLabelText('Reintentar')); });
  expect(reintentar).toHaveBeenCalledTimes(1);
});

test('el mensaje se puede cambiar', async () => {
  await render(<ErrorDeCarga etiqueta="No pudimos comprobar" mensaje="Mensaje propio." onReintentar={() => {}} />);
  expect(screen.getByText('Mensaje propio.')).toBeTruthy();
});
