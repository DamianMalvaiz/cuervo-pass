import { fireEvent, render, screen } from '@testing-library/react-native';

// Las listas locales de «Guardados» en la app: Vistos y Comparar. Cuatro estados distintos cada una (END-11): nada, cargando, FALLÓ y la lista; un lugar que ya no es visible se dice; las acciones hacen lo que dicen.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mockEstado = { vistos: [] as string[], comparados: [] as string[], pubs: [] as unknown[], cargando: false, fallo: false };
const mockBorrar = jest.fn();
const mockVaciar = jest.fn();
const mockReintentar = jest.fn();
jest.mock('@/hooks/use-vistos', () => ({ useVistos: () => mockEstado.vistos }));
jest.mock('@/hooks/use-comparar', () => ({ useComparar: () => ({ ids: mockEstado.comparados, lleno: false, alternar: jest.fn() }) }));
jest.mock('@/lib/vistos', () => ({ borrarVistos: () => mockBorrar() }));
jest.mock('@/lib/comparar', () => ({ vaciarComparar: () => mockVaciar() }));
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionesPorIds: () => ({ publicaciones: mockEstado.pubs, cargando: mockEstado.cargando, fallo: mockEstado.fallo, reintentar: mockReintentar }),
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));

import { ListaComparar, ListaVistos } from '../ListasLocalesApp';

const pub = (n: number) => ({ id: id(n), titulo_publico: `Lugar ${n}`, tipo: 'cuarto', precio_renta: 2900 + n, zona: 'Centro, Lerma', recamaras: 1, amueblado: false, num_fotos: 0 });

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockEstado, { vistos: [], comparados: [], pubs: [], cargando: false, fallo: false });
});

describe('Vistos', () => {
  it('sin nada visto lo dice y aclara que se guarda en el teléfono', async () => {
    await render(<ListaVistos />);
    expect(screen.getByText(/Todavía no has abierto ningún lugar/)).toBeTruthy();
    expect(screen.getByText(/solo en este teléfono/)).toBeTruthy();
  });
  it('si la lectura falla lo dice con reintento, no «todavía no has abierto nada»', async () => {
    Object.assign(mockEstado, { vistos: [id(1)], fallo: true });
    await render(<ListaVistos />);
    expect(screen.getByText('No pudimos cargar lo que viste')).toBeTruthy();
    expect(screen.queryByText(/Todavía no has abierto/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(mockReintentar).toHaveBeenCalled();
  });
  it('enseña lo visto en orden, dice cuántos ya no están y abre la ficha de la app', async () => {
    Object.assign(mockEstado, { vistos: [id(2), id(9), id(1)], pubs: [pub(1), pub(2)] });
    await render(<ListaVistos />);
    expect(screen.getAllByText(/^Lugar \d$/).map((n) => n.props.children)).toEqual(['Lugar 2', 'Lugar 1']);
    expect(screen.getByText('1 lugar de esta lista ya no está disponible.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/^Lugar 2,/));
    expect(mockPush).toHaveBeenCalledWith(`/publicacion/${id(2)}`);
  });
  it('«Borrar historial» vacía la lista', async () => {
    Object.assign(mockEstado, { vistos: [id(1)], pubs: [pub(1)] });
    await render(<ListaVistos />);
    await fireEvent.press(screen.getByLabelText('Borrar el historial de vistos'));
    expect(mockBorrar).toHaveBeenCalledTimes(1);
  });
});

describe('Comparar', () => {
  it('sin nada elegido explica cómo agregar', async () => {
    await render(<ListaComparar />);
    expect(screen.getByText(/toca «Comparar» \(hasta 3\)/)).toBeTruthy();
  });
  it('si la lectura falla lo dice, no «aún no eliges nada»', async () => {
    Object.assign(mockEstado, { comparados: [id(1)], fallo: true });
    await render(<ListaComparar />);
    expect(screen.getByText('No pudimos cargar lo que quieres comparar')).toBeTruthy();
    expect(screen.queryByText(/Aún no eliges/)).toBeNull();
  });
  it('con un solo lugar pide agregar otro; no ofrece comparar lado a lado', async () => {
    Object.assign(mockEstado, { comparados: [id(1)], pubs: [pub(1)] });
    await render(<ListaComparar />);
    expect(screen.getByText('Agrega al menos un lugar más para compararlos.')).toBeTruthy();
    expect(screen.queryByLabelText('Comparar lado a lado')).toBeNull();
  });
  it('con dos o más ofrece «Comparar lado a lado» (lleva a /comparar) y «Vaciar»', async () => {
    Object.assign(mockEstado, { comparados: [id(1), id(2)], pubs: [pub(1), pub(2)] });
    await render(<ListaComparar />);
    await fireEvent.press(screen.getByLabelText('Comparar lado a lado'));
    expect(mockPush).toHaveBeenCalledWith('/comparar');
    await fireEvent.press(screen.getByLabelText('Vaciar la lista de comparar'));
    expect(mockVaciar).toHaveBeenCalledTimes(1);
  });
});
