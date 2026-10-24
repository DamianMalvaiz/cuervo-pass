import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockMiNegocio = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'n1' }) }));
jest.mock('@/hooks/queries/useMisNegocios', () => ({ useMiNegocio: (...a: unknown[]) => mockMiNegocio(...a) }));
jest.mock('@/components/FormularioNegocio', () => ({
  FormularioNegocio: ({ inicial }: { inicial?: { negocio: { nombre: string } } }) => {
    const { Text } = require('react-native');
    return <Text>{`FORMULARIO:${inicial ? inicial.negocio.nombre : 'NUEVO'}`}</Text>;
  },
}));

import EditarNegocioScreen from '../editar/[id]';

const estado = (extra: Record<string, unknown> = {}) => ({
  negocio: { id: 'n1', nombre: 'Tacos' }, items: [], cargando: false, fallo: false, reintentar: jest.fn(), ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMiNegocio.mockReturnValue(estado());
});

test('pide el negocio con el id de la ruta y monta el formulario con SUS datos', async () => {
  await render(<EditarNegocioScreen />);
  expect(mockMiNegocio).toHaveBeenCalledWith('n1');
  expect(screen.getByText('FORMULARIO:Tacos')).toBeTruthy();
});

test('mientras carga no monta el formulario en blanco', async () => {
  mockMiNegocio.mockReturnValue(estado({ negocio: null, cargando: true }));
  await render(<EditarNegocioScreen />);
  expect(screen.getByLabelText('Cargando')).toBeTruthy();
  expect(screen.queryByText(/FORMULARIO/)).toBeNull();
});

test('un fallo de lectura se dice y ofrece reintentar, sin decir que no existe', async () => {
  const reintentar = jest.fn();
  mockMiNegocio.mockReturnValue(estado({ negocio: null, fallo: true, reintentar }));
  await render(<EditarNegocioScreen />);
  expect(screen.queryByText(/no existe/)).toBeNull();
  await act(async () => { fireEvent.press(screen.getByLabelText('Reintentar')); });
  expect(reintentar).toHaveBeenCalled();
});

test('un negocio que no existe o no es tuyo lo dice', async () => {
  mockMiNegocio.mockReturnValue(estado({ negocio: null }));
  await render(<EditarNegocioScreen />);
  expect(screen.getByText(/no existe o no es tuyo/)).toBeTruthy();
});
