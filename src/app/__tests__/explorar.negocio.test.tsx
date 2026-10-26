import { fireEvent, render, screen } from '@testing-library/react-native';

// Ficha pública de un negocio (sin cuenta): descripción, si está abierto, horario día por día y productos con precio. Un menú que no cargó NO es un menú vacío (END-11);
// «no existe» y «falló» son estados distintos. Escribir al negocio o guardarlo pide cuenta.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => ({ id: 'n1' }),
}));

const mockNeg = { negocio: null as unknown, cargando: false, fallo: false, reintentar: jest.fn() };
const mockProd = { productos: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
const mockHor = { horario: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
jest.mock('@/hooks/queries/useExplorar', () => ({
  useNegocioPublico: () => mockNeg,
  useProductosPublicos: () => mockProd,
  useHorarioPublico: () => mockHor,
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));

import FichaNegocio from '../explorar/negocio/[id]';

const NEGOCIO = {
  id: 'n1', categoria_id: 'c1', nombre: 'Café Lerma', descripcion: 'Café y pan del día', zona: 'Centro, Lerma', horario: null,
  num_fotos: 0, destacado: false, calificacion: 4.6, num_resenas: 5, abierto_ahora: true,
};
const PRODUCTOS = [
  { id: 'i1', negocio_id: 'n1', nombre: 'Capuchino', precio: 45, seccion: 'Bebidas', descripcion: null, num_fotos: 0, estrella: true, orden: 1 },
  { id: 'i2', negocio_id: 'n1', nombre: 'Concha', precio: null, seccion: 'Pan', descripcion: null, num_fotos: 0, estrella: false, orden: 2 },
];

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockNeg, { negocio: NEGOCIO, cargando: false, fallo: false });
  Object.assign(mockProd, { productos: PRODUCTOS, cargando: false, fallo: false });
  Object.assign(mockHor, { horario: [{ negocio_id: 'n1', dia: 1, abre: '09:00:00', cierra: '18:00:00' }], cargando: false, fallo: false });
});

test('enseña nombre, descripción, zona, calificación y que está abierto', async () => {
  await render(<FichaNegocio />);
  expect(screen.getByText('Café Lerma')).toBeTruthy();
  expect(screen.getByText('Café y pan del día')).toBeTruthy();
  expect(screen.getByText(/Centro, Lerma/)).toBeTruthy();
  expect(screen.getByText(/4\.6/)).toBeTruthy();
  expect(screen.getByText(/Abierto ahora/)).toBeTruthy();
});

test('un negocio cerrado lo dice', async () => {
  Object.assign(mockNeg, { negocio: { ...NEGOCIO, abierto_ahora: false } });
  await render(<FichaNegocio />);
  expect(screen.getByText(/Cerrado ahora/)).toBeTruthy();
});

test('horario día por día, con los siete días', async () => {
  await render(<FichaNegocio />);
  expect(screen.getByText('Lunes')).toBeTruthy();
  expect(screen.getByText('Domingo')).toBeTruthy();
  expect(screen.getAllByText('Cerrado').length).toBe(6);
});

test('productos con precio; sin precio dice «Consulta el precio», no inventa uno', async () => {
  await render(<FichaNegocio />);
  expect(screen.getByText('Capuchino')).toBeTruthy();
  expect(screen.getByText(/\$45/)).toBeTruthy();
  expect(screen.getByText('Concha')).toBeTruthy();
  expect(screen.getByText(/Consulta el precio/)).toBeTruthy();
});

test('si el menú falla, ofrece reintentar y NO dice que no hay productos', async () => {
  Object.assign(mockProd, { productos: [], fallo: true });
  await render(<FichaNegocio />);
  expect(screen.queryByText(/no tiene productos/i)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(mockProd.reintentar).toHaveBeenCalled();
});

test('un negocio sin productos publicados lo dice sin alarmar', async () => {
  Object.assign(mockProd, { productos: [] });
  await render(<FichaNegocio />);
  expect(screen.getByText(/no tiene productos/i)).toBeTruthy();
});

test('no existe → «ya no está disponible»; falla → reintentar', async () => {
  Object.assign(mockNeg, { negocio: null });
  const { unmount } = await render(<FichaNegocio />);
  expect(screen.getByText(/ya no está disponible/i)).toBeTruthy();
  await unmount();
  Object.assign(mockNeg, { negocio: null, fallo: true });
  await render(<FichaNegocio />);
  expect(screen.queryByText(/ya no está disponible/i)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(mockNeg.reintentar).toHaveBeenCalled();
});

test('lo que necesita cuenta lleva a entrar', async () => {
  await render(<FichaNegocio />);
  await fireEvent.press(screen.getByLabelText('Iniciar sesión para escribir'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
});
