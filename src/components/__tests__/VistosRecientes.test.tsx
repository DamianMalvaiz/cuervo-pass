import { fireEvent, render, screen } from '@testing-library/react-native';

// «Vistos recientemente» en la app: sin nada visto no ocupa lugar; la más reciente primero; lo que ya no es visible no sale; si la lectura FALLA se dice; borrar vacía la lista.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mockEstado = { ids: [] as string[], pubs: [] as unknown[], cargando: false, fallo: false };
const mockBorrar = jest.fn();
const mockReintentar = jest.fn();
jest.mock('@/hooks/use-vistos', () => ({ useVistos: () => mockEstado.ids }));
jest.mock('@/lib/vistos', () => ({ borrarVistos: () => mockBorrar() }));
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionesPorIds: () => ({ publicaciones: mockEstado.pubs, cargando: mockEstado.cargando, fallo: mockEstado.fallo, reintentar: mockReintentar }),
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));

import { VistosRecientes } from '../VistosRecientes';

const pub = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(n), titulo_publico: `Lugar ${n}`, tipo: 'cuarto', precio_renta: 2900 + n, zona: 'Santa María, Lerma, México, CP 52000', num_fotos: 0, ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockEstado, { ids: [], pubs: [], cargando: false, fallo: false });
});

it('sin nada visto no ocupa lugar', async () => {
  await render(<VistosRecientes />);
  expect(screen.queryByText('Vistos recientemente')).toBeNull();
});

it('enseña lo visto con su precio, la más reciente primero, y una toca la ficha de la app', async () => {
  Object.assign(mockEstado, { ids: [id(2), id(1)], pubs: [pub(1), pub(2)] });
  await render(<VistosRecientes />);
  expect(screen.getByText('Vistos recientemente')).toBeTruthy();
  const titulos = screen.getAllByText(/^Lugar \d$/).map((n) => n.props.children);
  expect(titulos).toEqual(['Lugar 2', 'Lugar 1']);
  expect(screen.getByText('$2,902')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(/^Lugar 2,/));
  expect(mockPush).toHaveBeenCalledWith(`/publicacion/${id(2)}`);
});

it('lo que ya no es visible no sale (y no rompe)', async () => {
  Object.assign(mockEstado, { ids: [id(1), id(9)], pubs: [pub(1)] });
  await render(<VistosRecientes />);
  expect(screen.getByText('Lugar 1')).toBeTruthy();
  expect(screen.queryByText(/Lugar 9/)).toBeNull();
});

it('si la lectura falla lo dice y ofrece reintentar, no lo esconde', async () => {
  Object.assign(mockEstado, { ids: [id(1)], fallo: true });
  await render(<VistosRecientes />);
  expect(screen.getByText('No pudimos cargar lo que viste')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(mockReintentar).toHaveBeenCalled();
});

it('«Borrar» vacía la lista', async () => {
  Object.assign(mockEstado, { ids: [id(1)], pubs: [pub(1)] });
  await render(<VistosRecientes />);
  await fireEvent.press(screen.getByLabelText('Borrar vistos recientemente'));
  expect(mockBorrar).toHaveBeenCalledTimes(1);
});
