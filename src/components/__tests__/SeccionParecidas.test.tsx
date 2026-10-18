import { fireEvent, render, screen } from '@testing-library/react-native';

// «Parecidos a este» (0071). Lo que se fija: sin nada parecido NO hay sección; un fallo se dice (no es «sin parecidos»); y tocar una abre esa ficha.

const mockParecidas = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/usePublicaciones', () => ({ useParecidas: (...a: unknown[]) => mockParecidas(...a) }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map() }) }));
jest.mock('@/hooks/use-miniaturas', () => ({ useMiniaturas: () => () => null }));
jest.mock('@/components/FilaPublicacion', () => ({
  FilaPublicacion: ({ titulo, onPress }: { titulo: string; onPress: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable accessibilityLabel={titulo} onPress={onPress}><Text>{titulo}</Text></Pressable>;
  },
}));

import { SeccionParecidas } from '../SeccionParecidas';

const fila = (id: string) => ({ id, titulo: `Depa ${id}`, tipo: 'depa', direccion: 'x', precio_renta: 2500, fotos: [], similitud: 0.8 });

beforeEach(() => jest.clearAllMocks());

it('pide los parecidos de ESA publicación', async () => {
  mockParecidas.mockReturnValue({ parecidas: [], cargando: false, fallo: false });
  await render(<SeccionParecidas publicacionId="p1" />);
  expect(mockParecidas).toHaveBeenCalledWith('p1');
});

it('con parecidos, los enseña y tocar uno abre su ficha', async () => {
  mockParecidas.mockReturnValue({ parecidas: [fila('q1'), fila('q2')], cargando: false, fallo: false });
  await render(<SeccionParecidas publicacionId="p1" />);
  expect(screen.getByText('Parecidos a este')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Depa q2'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/publicacion/[id]', params: { id: 'q2' } });
});

it('sin nada lo bastante parecido, la sección no aparece', async () => {
  mockParecidas.mockReturnValue({ parecidas: [], cargando: false, fallo: false });
  await render(<SeccionParecidas publicacionId="p1" />);
  expect(screen.queryByText('Parecidos a este')).toBeNull();
});

it('mientras carga no pinta nada', async () => {
  mockParecidas.mockReturnValue({ parecidas: [], cargando: true, fallo: false });
  await render(<SeccionParecidas publicacionId="p1" />);
  expect(screen.queryByText('Parecidos a este')).toBeNull();
});

it('si falla, lo dice: no es lo mismo que «no hay parecidos»', async () => {
  mockParecidas.mockReturnValue({ parecidas: [], cargando: false, fallo: true });
  await render(<SeccionParecidas publicacionId="p1" />);
  expect(screen.getByText(/No pudimos cargar los parecidos/)).toBeTruthy();
});
