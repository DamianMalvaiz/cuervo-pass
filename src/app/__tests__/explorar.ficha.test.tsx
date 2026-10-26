import { fireEvent, render, screen } from '@testing-library/react-native';

// Ficha pública de un depa (sin cuenta): datos reducidos. Lo que se fija: enseña lo que hay (precio, zona, características, calificación), NO enseña ni pide dirección,
// teléfono ni quién publica; lo que requiere cuenta (escribir, guardar) lleva a entrar; «no existe» y «falló la lectura» son estados distintos (END-11).

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => ({ id: 'p1' }),
}));

const mockPub = { publicacion: null as unknown, cargando: false, fallo: false, reintentar: jest.fn() };
const mockFotos = { fotos: [] as string[], cargando: false, fallo: false };
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionPublica: () => mockPub,
  useFotosPublicas: () => mockFotos,
}));

import FichaPublica from '../explorar/[id]';

const DEPA = {
  id: 'p1', titulo: 'Cuarto con baño propio', tipo: 'cuarto', precio_renta: 2900, recamaras: 1, amueblado: true, permite_mascotas: false,
  servicios_incluidos: ['agua', 'internet'], zona: 'Santa María, Lerma', num_fotos: 0, destacado: true, calificacion: 4.9, num_resenas: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockPub, { publicacion: DEPA, cargando: false, fallo: false });
});

test('enseña precio, zona, características y calificación', async () => {
  await render(<FichaPublica />);
  expect(screen.getByText('Cuarto con baño propio')).toBeTruthy();
  expect(screen.getByText(/2,900/)).toBeTruthy();
  expect(screen.getByText(/Santa María/)).toBeTruthy();
  expect(screen.getByText(/Amueblado/)).toBeTruthy();
  expect(screen.getByText(/agua/i)).toBeTruthy();
  expect(screen.getByText(/4\.9/)).toBeTruthy();
});

test('lo que necesita cuenta lleva a entrar o crearla', async () => {
  await render(<FichaPublica />);
  await fireEvent.press(screen.getByLabelText('Iniciar sesión para escribir'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  await fireEvent.press(screen.getByLabelText('Crear cuenta'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/registro');
});

test('explica por qué no hay dirección exacta, sin inventar una', async () => {
  await render(<FichaPublica />);
  expect(screen.getByText(/dirección exacta/i)).toBeTruthy();
});

test('si no existe o ya no es visible, lo dice', async () => {
  Object.assign(mockPub, { publicacion: null });
  await render(<FichaPublica />);
  expect(screen.getByText(/ya no está disponible/i)).toBeTruthy();
});

test('si la lectura falla, ofrece reintentar y NO dice que no existe', async () => {
  Object.assign(mockPub, { publicacion: null, fallo: true });
  await render(<FichaPublica />);
  expect(screen.queryByText(/ya no está disponible/i)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(mockPub.reintentar).toHaveBeenCalled();
});
