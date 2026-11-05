import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

// /comparar EN LA APP: sin el marco de la web, con las rutas de la app (la ficha es /publicacion/<id>; explorar es la pestaña de inicio) y diciendo «teléfono», no «navegador».

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/components/web/PaginaWeb', () => ({
  PaginaWeb: () => {
    throw new Error('la app no debe usar el marco de la web');
  },
}));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mockEstado = { ids: [] as string[], pubs: [] as unknown[] };
jest.mock('@/hooks/use-comparar', () => ({ useComparar: () => ({ ids: mockEstado.ids, lleno: false, alternar: jest.fn() }) }));
jest.mock('@/lib/comparar', () => ({ MAX_COMPARAR: 3, quitarComparar: jest.fn(), vaciarComparar: jest.fn() }));
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionesPorIds: () => ({ publicaciones: mockEstado.pubs, cargando: false, fallo: false, reintentar: jest.fn() }),
}));

import { CompararWeb } from '../CompararWeb';

const pub = (n: number) => ({
  id: id(n), titulo_publico: `Lugar ${n}`, tipo: 'cuarto', precio_renta: 3000, recamaras: 1, amueblado: true, permite_mascotas: false,
  servicios_incluidos: null, zona: 'Santa María, Lerma', calificacion: null, num_resenas: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'ios');
  Object.assign(mockEstado, { ids: [], pubs: [] });
});
afterEach(() => jest.restoreAllMocks());

it('sin nada elegido lleva a explorar en la app (la pestaña de inicio), no a la página de la web', async () => {
  await render(<CompararWeb />);
  expect(screen.getByText(/La lista se queda en este teléfono/)).toBeTruthy();
  expect(screen.queryByText(/navegador/)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Explorar lugares'));
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/inicio');
});

it('el título de una columna abre la ficha DE LA APP', async () => {
  Object.assign(mockEstado, { ids: [id(1), id(2)], pubs: [pub(1), pub(2)] });
  await render(<CompararWeb />);
  await fireEvent.press(screen.getByLabelText('Ver Lugar 1'));
  expect(mockPush).toHaveBeenCalledWith(`/publicacion/${id(1)}`);
});

it('«Agregar otro lugar» también lleva a explorar en la app', async () => {
  Object.assign(mockEstado, { ids: [id(1), id(2)], pubs: [pub(1), pub(2)] });
  await render(<CompararWeb />);
  await fireEvent.press(screen.getByLabelText('Agregar otro lugar'));
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/inicio');
});
