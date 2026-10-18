import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

// Ficha de un negocio de Servicios · Cuervo 360. Tres estados y no dos (END-11): cargando, falló y «no existe» no
// son lo mismo. El menú dice «Consultar precio» cuando no hay uno, y nunca inventa un precio. Un negocio de ejemplo se
// rotula. «Cómo llegar» solo existe si hay coordenadas.

const mockNegocio = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'n1' }) }));
jest.mock('@/hooks/queries/useServicios', () => ({ useNegocio: (...a: unknown[]) => mockNegocio(...a) }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map(), fallo: null }) }));

import NegocioScreen from '../[id]';

const NEGOCIO = {
  id: 'n1', categoria_id: 'cafes', nombre: 'Café La Parada', descripcion: 'Café de olla y de especialidad.',
  direccion: 'Av. Las Torres 408, Lerma', latitud: 19.327, longitud: -99.457, rango_precio: 2,
  horario: 'Lun a sáb · 8 am a 9 pm', fotos: [], destacado: true, origen: 'sembrado',
};
const ITEMS = [
  { id: 'i1', negocio_id: 'n1', nombre: 'Café americano', precio: 35, orden: 0 },
  { id: 'i2', negocio_id: 'n1', nombre: 'Revisión', precio: null, orden: 1 },
];
const estado = (extra: Record<string, unknown> = {}) => ({
  negocio: NEGOCIO, items: ITEMS, cargando: false, fallo: false, reintentar: jest.fn(), ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockNegocio.mockReturnValue(estado());
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

test('pide el negocio con el id de la ruta', async () => {
  await render(<NegocioScreen />);
  expect(mockNegocio).toHaveBeenCalledWith('n1');
});

test('pinta nombre, descripción, dirección, horario y precio', async () => {
  await render(<NegocioScreen />);
  expect(screen.getByText('Café La Parada')).toBeTruthy();
  expect(screen.getByText('Café de olla y de especialidad.')).toBeTruthy();
  expect(screen.getByText('Av. Las Torres 408, Lerma')).toBeTruthy();
  expect(screen.getByText('Lun a sáb · 8 am a 9 pm')).toBeTruthy();
  expect(screen.getByText('$$')).toBeTruthy();
});

test('un negocio de ejemplo se rotula', async () => {
  await render(<NegocioScreen />);
  expect(screen.getByText('Negocio de ejemplo')).toBeTruthy();
});

test('un negocio real no lleva el rótulo de ejemplo', async () => {
  mockNegocio.mockReturnValue(estado({ negocio: { ...NEGOCIO, origen: 'solicitud' } }));
  await render(<NegocioScreen />);
  expect(screen.queryByText('Negocio de ejemplo')).toBeNull();
});

test('el menú dice el precio, o «Consultar precio» si no lo hay (nunca lo inventa)', async () => {
  await render(<NegocioScreen />);
  expect(screen.getByText('Café americano')).toBeTruthy();
  expect(screen.getByText('$35')).toBeTruthy();
  expect(screen.getByText('Revisión')).toBeTruthy();
  expect(screen.getByText('Consultar precio')).toBeTruthy();
});

test('sin productos no pinta un menú vacío', async () => {
  mockNegocio.mockReturnValue(estado({ items: [] }));
  await render(<NegocioScreen />);
  expect(screen.queryByText('Menú y precios')).toBeNull();
});

test('«Cómo llegar» abre el mapa con las coordenadas', async () => {
  await render(<NegocioScreen />);
  await act(async () => { fireEvent.press(screen.getByLabelText('Cómo llegar')); });
  expect(Linking.openURL).toHaveBeenCalledWith(
    'https://www.google.com/maps/search/?api=1&query=19.327,-99.457'
  );
});

test('sin coordenadas no hay «Cómo llegar»', async () => {
  mockNegocio.mockReturnValue(estado({ negocio: { ...NEGOCIO, latitud: null, longitud: null } }));
  await render(<NegocioScreen />);
  expect(screen.queryByLabelText('Cómo llegar')).toBeNull();
});

test('mientras carga no dice que no existe', async () => {
  mockNegocio.mockReturnValue(estado({ negocio: null, items: [], cargando: true }));
  await render(<NegocioScreen />);
  expect(screen.queryByText(/ya no está disponible/)).toBeNull();
  expect(screen.getByLabelText('Cargando')).toBeTruthy();
});

test('un fallo de lectura NO se pinta como «ya no está disponible»', async () => {
  const reintentar = jest.fn();
  mockNegocio.mockReturnValue(estado({ negocio: null, items: [], fallo: true, reintentar }));
  await render(<NegocioScreen />);
  expect(screen.queryByText(/ya no está disponible/)).toBeNull();
  await act(async () => { fireEvent.press(screen.getByLabelText('Reintentar')); });
  expect(reintentar).toHaveBeenCalled();
});

test('un negocio que no existe o no es visible lo dice', async () => {
  mockNegocio.mockReturnValue(estado({ negocio: null, items: [] }));
  await render(<NegocioScreen />);
  expect(screen.getByText(/ya no está disponible/)).toBeTruthy();
});
