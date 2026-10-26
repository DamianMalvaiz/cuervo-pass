import { fireEvent, render, screen } from '@testing-library/react-native';

// Portada pública de la web (tramo 1): se ve SIN cuenta, con datos reducidos. Lo que se fija: dice qué es, enseña lo que hay antes de pedir nada, lleva a entrar/registrarse,
// y un fallo de lectura NO se pinta como «no hay nada» (END-11).

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

const mockPub = { publicaciones: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
const mockNeg = { negocios: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
const mockCat = { categorias: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionesPublicas: () => mockPub,
  useNegociosPublicos: () => mockNeg,
  useCategoriasPublicas: () => mockCat,
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));

import Explorar from '../explorar';

const DEPA = { id: 'p1', titulo: 'Cuarto con baño propio', tipo: 'cuarto', precio_renta: 2900, zona: 'Santa María, Lerma', num_fotos: 0, destacado: true, calificacion: 4.9, num_resenas: 3 };

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockPub, { publicaciones: [DEPA], cargando: false, fallo: false });
  Object.assign(mockNeg, { negocios: [], cargando: false, fallo: false });
  Object.assign(mockCat, { categorias: [{ id: 'c1', nombre: 'Comida', icono: null, orden: 1 }], cargando: false, fallo: false });
});

test('dice qué es en una frase y deja entrar o crear cuenta', async () => {
  await render(<Explorar />);
  expect(screen.getByText(/dónde vivir/i)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  await fireEvent.press(screen.getByLabelText('Crear cuenta'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/registro');
});

test('enseña los departamentos con precio y zona, nunca la dirección', async () => {
  await render(<Explorar />);
  expect(screen.getByText('Cuarto con baño propio')).toBeTruthy();
  expect(screen.getByText(/2,900/)).toBeTruthy();
  expect(screen.getByText(/Santa María/)).toBeTruthy();
});

test('al tocar un departamento va a su ficha pública (sin cuenta)', async () => {
  await render(<Explorar />);
  await fireEvent.press(screen.getByLabelText(/Cuarto con baño propio/));
  expect(mockPush).toHaveBeenCalledWith('/explorar/p1');
});

test('si la lectura falla dice que falló (con reintento), no «no hay departamentos»', async () => {
  Object.assign(mockPub, { publicaciones: [], fallo: true });
  await render(<Explorar />);
  expect(screen.queryByText(/todavía no hay departamentos/i)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(mockPub.reintentar).toHaveBeenCalled();
});

test('si de verdad no hay departamentos, lo dice sin alarmar', async () => {
  Object.assign(mockPub, { publicaciones: [] });
  await render(<Explorar />);
  expect(screen.getByText(/todavía no hay departamentos/i)).toBeTruthy();
});

test('enseña los negocios y al tocar uno va a su ficha pública', async () => {
  Object.assign(mockNeg, { negocios: [{ id: 'n1', nombre: 'Café Lerma', zona: 'Centro, Lerma', abierto_ahora: true, calificacion: 4.6, num_fotos: 0, destacado: false }] });
  await render(<Explorar />);
  expect(screen.getByText('Café Lerma')).toBeTruthy();
  expect(screen.getByText(/Abierto ahora/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(/Café Lerma/));
  expect(mockPush).toHaveBeenCalledWith('/explorar/negocio/n1');
});

test('si fallan los negocios lo dice y deja reintentar; el resto de la portada sigue', async () => {
  Object.assign(mockNeg, { negocios: [], fallo: true });
  await render(<Explorar />);
  expect(screen.getByText('Cuarto con baño propio')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(mockNeg.reintentar).toHaveBeenCalled();
});
