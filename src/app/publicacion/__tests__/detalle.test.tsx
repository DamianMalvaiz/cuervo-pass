import { fireEvent, render, screen } from '@testing-library/react-native';

// END-11 · El peor mensaje que tenía la app.
//
// `obtenerPublicacionPublica(id).catch(...)` dejaba la publicación en null, y
// la pantalla entonces decía:
//
//   «FICHA NO DISPONIBLE — Esta publicación ya no está disponible. Pudo
//    desactivarse o ocultarse tras varios reportes.»
//
// Se cae el wifi y la app afirma que esa publicación fue REPORTADA por abuso.
// No es un mensaje impreciso: es una acusación inventada por un fallo de red,
// sobre el anuncio de otra persona.

const mockObtener = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'pub1' }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));
jest.mock('@/services/publicaciones.service', () => ({
  obtenerPublicacionPublica: (...a: unknown[]) => mockObtener(...a),
  revelarContacto: jest.fn(),
  reportarPublicacion: jest.fn(),
}));
jest.mock('@/services/mensajes.service', () => ({ abrirConversacion: jest.fn() }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({}) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: Object.assign(
    (sel?: (s: unknown) => unknown) => {
      const estado = { perfil: { id: 'u1' }, cargando: false, error: null, cargarPerfil: jest.fn() };
      return sel ? sel(estado) : estado;
    },
    { getState: () => ({ cargarPerfil: jest.fn() }) }
  ),
}));

import Detalle from '../[id]';

const PUB = {
  id: 'pub1', titulo: 'Depa cerca del campus', tipo: 'depa', direccion: 'San Mateo Atenco',
  precio_renta: 2800, descripcion: 'Luminoso', fotos: null, permite_mascotas: false,
  amueblado: true, servicios_incluidos: false, recamaras: 1, latitud: 19.29, longitud: -99.56,
  usuario_id: 'otro', creada_en: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('con datos, pinta la ficha', async () => {
  mockObtener.mockResolvedValue(PUB);
  await render(<Detalle />);
  expect(await screen.findByText('Depa cerca del campus', {}, { timeout: 5000 })).toBeTruthy();
});

// Vacío legítimo: la publicación de verdad ya no está.
test('si no existe, dice que no está disponible', async () => {
  mockObtener.mockResolvedValue(null);
  await render(<Detalle />);
  expect(await screen.findByText('FICHA NO DISPONIBLE', {}, { timeout: 5000 })).toBeTruthy();
});

// LA prueba. Un fallo de red NO puede producir el mensaje de arriba.
test('si falla la red, NO acusa de reportes: dice que no se pudo consultar', async () => {
  mockObtener.mockRejectedValue(new Error('network request failed'));
  await render(<Detalle />);
  expect(await screen.findByText('NO PUDIMOS CONSULTAR', {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.queryByText('FICHA NO DISPONIBLE')).toBeNull();
  expect(screen.queryByText(/reportes/i)).toBeNull();
});

// Un error sin salida deja la pantalla muerta. Con la red intermitente de un
// aula, reintentar es la diferencia entre seguir la demo y reiniciar la app.
test('el estado de error ofrece reintentar, y reintentar vuelve a consultar', async () => {
  mockObtener.mockRejectedValue(new Error('network request failed'));
  await render(<Detalle />);
  expect(await screen.findByText('NO PUDIMOS CONSULTAR', {}, { timeout: 5000 })).toBeTruthy();

  mockObtener.mockResolvedValue(PUB);
  fireEvent.press(await screen.findByLabelText('Reintentar', {}, { timeout: 5000 }));
  expect(await screen.findByText('Depa cerca del campus', {}, { timeout: 5000 })).toBeTruthy();
});
