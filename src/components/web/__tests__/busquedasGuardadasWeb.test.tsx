import { fireEvent, render, screen } from '@testing-library/react-native';

// Búsquedas guardadas en /departamentos: sin cuenta no hay nada; con cuenta, un toque vuelve a una búsqueda (validada por deParametros), la «x» la borra, y «Guardar esta búsqueda» solo aparece si hay filtros y no está ya guardada.
// Cargando, falló y «ninguna» son estados distintos; el tope se dice.

const mockSesion = { id: 'u1' as string | null };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockSesion.id ? { user: { id: mockSesion.id } } : null }) }));
const mockLista = { busquedas: [] as { id: string; nombre: string; filtros: Record<string, string> }[], cargando: false, fallo: false, reintentar: jest.fn() };
const mockGuardar = jest.fn();
const mockBorrar = jest.fn();
jest.mock('@/hooks/queries/useBusquedasGuardadas', () => ({
  useBusquedasGuardadas: () => mockLista,
  useGuardarBusqueda: () => ({ mutate: (...a: unknown[]) => mockGuardar(...a), isPending: false }),
  useBorrarBusqueda: () => ({ mutate: (...a: unknown[]) => mockBorrar(...a), isPending: false }),
}));
const mockExito = jest.fn();
const mockError = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { exito: (...a: unknown[]) => mockExito(...a), error: (...a: unknown[]) => mockError(...a), info: jest.fn() } }));

import { FILTROS_VACIOS } from '@/lib/filtrosWeb';
import { BusquedasGuardadasWeb, nombreDeBusqueda } from '../BusquedasGuardadasWeb';

const CON = { ...FILTROS_VACIOS, zona: 'Lerma', tipo: 'cuarto' as const, presupuesto: '4000' };
beforeEach(() => {
  jest.clearAllMocks();
  mockSesion.id = 'u1';
  Object.assign(mockLista, { busquedas: [], cargando: false, fallo: false });
});

it('sin cuenta no ocupa lugar', async () => {
  mockSesion.id = null;
  await render(<BusquedasGuardadasWeb aplicados={CON} onAplicar={jest.fn()} />);
  expect(screen.queryByLabelText('Guardar esta búsqueda')).toBeNull();
});

it('el nombre es lo que la píldora diría de la búsqueda', () => {
  expect(nombreDeBusqueda(CON)).toBe('Lerma · Cuarto · hasta $4,000');
  expect(nombreDeBusqueda(CON).length).toBeLessThanOrEqual(80);
});

describe('guardar', () => {
  it('con filtros aplicados y sin estar guardada, ofrece guardarla y la guarda con sus filtros', async () => {
    await render(<BusquedasGuardadasWeb aplicados={CON} onAplicar={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Guardar esta búsqueda'));
    expect(mockGuardar.mock.calls[0][0]).toEqual({ nombre: 'Lerma · Cuarto · hasta $4,000', filtros: { zona: 'Lerma', presupuesto: '4000', tipo: 'cuarto' } });
  });

  it('sin filtros no hay nada que guardar', async () => {
    await render(<BusquedasGuardadasWeb aplicados={FILTROS_VACIOS} onAplicar={jest.fn()} />);
    expect(screen.queryByLabelText('Guardar esta búsqueda')).toBeNull();
  });

  it('si ya está guardada no se ofrece otra vez', async () => {
    mockLista.busquedas = [{ id: 'b1', nombre: 'Lerma', filtros: { zona: 'Lerma', presupuesto: '4000', tipo: 'cuarto' } }];
    await render(<BusquedasGuardadasWeb aplicados={CON} onAplicar={jest.fn()} />);
    expect(screen.queryByLabelText('Guardar esta búsqueda')).toBeNull();
  });

  it('el éxito se dice; el tope (CP004) y cualquier otro fallo, cada uno con su mensaje', async () => {
    await render(<BusquedasGuardadasWeb aplicados={CON} onAplicar={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Guardar esta búsqueda'));
    mockGuardar.mock.calls[0][1].onSuccess();
    expect(mockExito).toHaveBeenCalledWith('Búsqueda guardada');
    mockGuardar.mock.calls[0][1].onError({ code: 'CP004' });
    expect(String(mockError.mock.calls[0][0])).toMatch(/20 búsquedas/);
    mockGuardar.mock.calls[0][1].onError(new Error('x'));
    expect(String(mockError.mock.calls[1][0])).toMatch(/No pudimos guardar/);
  });
});

describe('las guardadas', () => {
  it('un toque vuelve a la búsqueda, con los filtros validados (un tipo inventado no pasa)', async () => {
    mockLista.busquedas = [{ id: 'b1', nombre: 'Lerma · Cuarto', filtros: { zona: 'Lerma', tipo: 'cuarto', amueblado: '1' } }, { id: 'b2', nombre: 'Rara', filtros: { tipo: 'castillo', presupuesto: 'abc4000' } }];
    const alAplicar = jest.fn();
    await render(<BusquedasGuardadasWeb aplicados={FILTROS_VACIOS} onAplicar={alAplicar} />);
    await fireEvent.press(screen.getByLabelText('Buscar de nuevo: Lerma · Cuarto'));
    expect(alAplicar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, zona: 'Lerma', tipo: 'cuarto', amueblado: true });
    await fireEvent.press(screen.getByLabelText('Buscar de nuevo: Rara'));
    expect(alAplicar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, tipo: null, presupuesto: '4000' });
  });

  it('la «x» borra ESA búsqueda, y si falla lo dice', async () => {
    mockLista.busquedas = [{ id: 'b1', nombre: 'Lerma', filtros: { zona: 'Lerma' } }];
    await render(<BusquedasGuardadasWeb aplicados={FILTROS_VACIOS} onAplicar={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Borrar la búsqueda guardada: Lerma'));
    expect(mockBorrar.mock.calls[0][0]).toBe('b1');
    mockBorrar.mock.calls[0][1].onError();
    expect(String(mockError.mock.calls[0][0])).toMatch(/No pudimos borrar/);
  });
});

describe('estados', () => {
  it('si FALLÓ la lectura lo dice, con reintento (no «no tienes ninguna»)', async () => {
    mockLista.fallo = true;
    await render(<BusquedasGuardadasWeb aplicados={FILTROS_VACIOS} onAplicar={jest.fn()} />);
    expect(screen.getByText('No pudimos cargar tus búsquedas guardadas')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(mockLista.reintentar).toHaveBeenCalled();
  });

  it('mientras carga no afirma nada (ni ofrece guardar sobre una lista que no se sabe)', async () => {
    mockLista.cargando = true;
    await render(<BusquedasGuardadasWeb aplicados={CON} onAplicar={jest.fn()} />);
    expect(screen.queryByLabelText('Guardar esta búsqueda')).toBeNull();
    expect(screen.queryByText('No pudimos cargar tus búsquedas guardadas')).toBeNull();
  });
});
