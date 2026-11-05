import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

// /comparar: nada elegido, cargando, falló, y la tabla. Solo marca como hecho la renta más baja (y no en un empate); un «sin dato» no es un «No»; lo que ya no es visible se dice.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/components/web/PaginaWeb', () => ({ PaginaWeb: ({ children }: { children: React.ReactNode }) => children }));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mockEstado = { ids: [] as string[], pubs: [] as unknown[], cargando: false, fallo: false };
const mockQuitar = jest.fn();
const mockVaciar = jest.fn();
jest.mock('@/hooks/use-comparar', () => ({ useComparar: () => ({ ids: mockEstado.ids, lleno: false, alternar: jest.fn() }) }));
jest.mock('@/lib/comparar', () => ({ MAX_COMPARAR: 3, quitarComparar: (...a: unknown[]) => mockQuitar(...a), vaciarComparar: () => mockVaciar() }));
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionesPorIds: () => ({ publicaciones: mockEstado.pubs, cargando: mockEstado.cargando, fallo: mockEstado.fallo, reintentar: jest.fn() }),
}));

import { CompararWeb } from '../CompararWeb';

const pub = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(n), titulo_publico: `Lugar ${n}`, tipo: 'cuarto', precio_renta: 3000, recamaras: 1, amueblado: true, permite_mascotas: false,
  servicios_incluidos: null, zona: 'Santa María, Lerma, México, CP 52000', calificacion: null, num_resenas: null, ...extra,
});
// Estas pruebas son de la WEB; la app tiene las suyas en compararApp.test.tsx.
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'web');
  Object.assign(mockEstado, { ids: [], pubs: [], cargando: false, fallo: false });
});

afterEach(() => jest.restoreAllMocks());

it('sin nada elegido explica cómo agregar y lleva a explorar', async () => {
  await render(<CompararWeb />);
  expect(screen.getByText(/toca «Comparar»/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Explorar lugares'));
  expect(mockPush).toHaveBeenCalledWith('/departamentos');
});

it('si la lectura falla lo dice, no «aún no eliges nada»', async () => {
  Object.assign(mockEstado, { ids: [id(1)], fallo: true });
  await render(<CompararWeb />);
  expect(screen.getByText('No pudimos cargar la comparación')).toBeTruthy();
  expect(screen.queryByText(/toca «Comparar»/)).toBeNull();
});

it('pone lado a lado y marca solo la renta más baja', async () => {
  Object.assign(mockEstado, { ids: [id(1), id(2)], pubs: [pub(1, { precio_renta: 3500 }), pub(2, { precio_renta: 2800 })] });
  await render(<CompararWeb />);
  expect(screen.getByText('$3,500')).toBeTruthy();
  expect(screen.getByText('$2,800')).toBeTruthy();
  expect(screen.getAllByText('Más barato')).toHaveLength(1);
});

it('con rentas iguales, o con un solo lugar, no hay «más barato»', async () => {
  Object.assign(mockEstado, { ids: [id(1), id(2)], pubs: [pub(1), pub(2)] });
  await render(<CompararWeb />);
  expect(screen.queryByText('Más barato')).toBeNull();
});

it('un dato que falta dice «Sin dato», no «No»', async () => {
  Object.assign(mockEstado, { ids: [id(1)], pubs: [pub(1)] });
  await render(<CompararWeb />);
  expect(screen.getByText('Sin dato')).toBeTruthy(); // servicios_incluidos
  expect(screen.getByText('Sin reseñas')).toBeTruthy();
});

it('lo que ya no es visible se dice y se puede quitar', async () => {
  Object.assign(mockEstado, { ids: [id(1), id(2)], pubs: [pub(1)] });
  await render(<CompararWeb />);
  expect(screen.getByText('1 lugar de tu lista ya no está disponible.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Quitar los que ya no están'));
  expect(mockQuitar).toHaveBeenCalledWith(id(2));
});

it('quitar una columna, vaciar y abrir la ficha funcionan', async () => {
  Object.assign(mockEstado, { ids: [id(1)], pubs: [pub(1)] });
  await render(<CompararWeb />);
  await fireEvent.press(screen.getByLabelText('Quitar Lugar 1 de la comparación'));
  expect(mockQuitar).toHaveBeenCalledWith(id(1));
  await fireEvent.press(screen.getByLabelText('Vaciar la comparación'));
  expect(mockVaciar).toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Ver Lugar 1'));
  expect(mockPush).toHaveBeenCalledWith(`/departamentos/${id(1)}`);
});
