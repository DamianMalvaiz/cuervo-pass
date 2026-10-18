import { render, screen } from '@testing-library/react-native';

// La foto de una tarjeta de lista. Lo que se fija: pide la miniatura primero, cae a la completa si la miniatura falla, y no revienta sin ninguna.

const mockImagen = jest.fn();
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => { mockImagen(props); return <View testID="imagen" />; } };
});

import { FotoLista } from '../FotoLista';

const MINI = { uri: 'https://x/render/mini.jpg', headers: { Authorization: 'Bearer t', apikey: 'k' } };

beforeEach(() => mockImagen.mockClear());
const ultima = () => mockImagen.mock.calls.at(-1)![0] as { source: unknown; onError?: () => void };

test('con miniatura y completa pide la miniatura, con sus cabeceras', async () => {
  await render(<FotoLista miniatura={MINI} completa="https://x/completa.jpg" />);
  expect(ultima().source).toEqual(MINI);
});

test('si la miniatura falla, cae a la foto completa', async () => {
  await render(<FotoLista miniatura={MINI} completa="https://x/completa.jpg" />);
  const { act } = require('@testing-library/react-native');
  await act(async () => { ultima().onError?.(); });
  expect(ultima().source).toEqual({ uri: 'https://x/completa.jpg' });
});

test('sin miniatura usa la completa, y no registra un respaldo que no existe', async () => {
  await render(<FotoLista completa="https://x/completa.jpg" />);
  expect(ultima().source).toEqual({ uri: 'https://x/completa.jpg' });
  expect(ultima().onError).toBeUndefined();
});

test('sin ninguna de las dos no pinta nada (la tarjeta pone su marcador)', async () => {
  await render(<FotoLista />);
  expect(screen.queryByTestId('imagen')).toBeNull();
});

test('si la miniatura falla y no hay completa, no se queda con una imagen rota', async () => {
  await render(<FotoLista miniatura={MINI} />);
  const { act } = require('@testing-library/react-native');
  await act(async () => { ultima().onError?.(); });
  expect(screen.queryByTestId('imagen')).toBeNull();
});
