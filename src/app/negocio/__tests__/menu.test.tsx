import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockMiNegocio = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'n1' }) }));
jest.mock('@/hooks/queries/useMisNegocios', () => ({ useMiNegocio: (...a: unknown[]) => mockMiNegocio(...a) }));
jest.mock('@/components/EditorMenu', () => ({
  EditorMenu: ({ nombreNegocio, items }: { nombreNegocio: string; items: unknown[] }) => {
    const { Text } = require('react-native');
    return <Text>{`EDITOR:${nombreNegocio}:${items.length}`}</Text>;
  },
}));

import MenuNegocioScreen from '../menu/[id]';

const estado = (extra: Record<string, unknown> = {}) => ({
  negocio: { id: 'n1', nombre: 'Tacos' }, items: [{ id: 'i1' }, { id: 'i2' }], cargando: false, fallo: false, reintentar: jest.fn(), ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMiNegocio.mockReturnValue(estado());
});

test('pide el negocio con el id de la ruta y monta el editor con SU menú real', async () => {
  await render(<MenuNegocioScreen />);
  expect(mockMiNegocio).toHaveBeenCalledWith('n1');
  expect(screen.getByText('EDITOR:Tacos:2')).toBeTruthy();
});

test('mientras carga NO monta el editor en blanco (pisaría el menú guardado)', async () => {
  mockMiNegocio.mockReturnValue(estado({ negocio: null, items: [], cargando: true }));
  await render(<MenuNegocioScreen />);
  expect(screen.getByLabelText('Cargando')).toBeTruthy();
  expect(screen.queryByText(/EDITOR/)).toBeNull();
});

test('un fallo de lectura se dice y ofrece reintentar, sin decir que no existe', async () => {
  const reintentar = jest.fn();
  mockMiNegocio.mockReturnValue(estado({ negocio: null, items: [], fallo: true, reintentar }));
  await render(<MenuNegocioScreen />);
  expect(screen.queryByText(/no existe/)).toBeNull();
  await act(async () => { fireEvent.press(screen.getByLabelText('Reintentar')); });
  expect(reintentar).toHaveBeenCalled();
});

test('un negocio que no existe o no es tuyo lo dice', async () => {
  mockMiNegocio.mockReturnValue(estado({ negocio: null, items: [] }));
  await render(<MenuNegocioScreen />);
  expect(screen.getByText(/no existe o no es tuyo/)).toBeTruthy();
});
