import { fireEvent, render, screen } from '@testing-library/react-native';

// «Comparar» en la barra de la ficha: agrega, quita; con la lista llena avisa y no agrega; con dos o más ofrece ver la comparación.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), canGoBack: () => true, back: jest.fn() } }));
jest.mock('@/components/web/CuentaWeb', () => ({ CuentaWeb: () => null }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: { session: null }) => unknown) => sel({ session: null }) }));

const mockC = { ids: [] as string[], lleno: false };
const mockAlternar = jest.fn();
jest.mock('@/hooks/use-comparar', () => ({ useComparar: () => ({ ...mockC, alternar: (...a: unknown[]) => mockAlternar(...a) }) }));

import { BarraFichaWeb } from '../BarraFichaWeb';

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockC, { ids: [], lleno: false });
});

it('agrega al tocar «Comparar»', async () => {
  await render(<BarraFichaWeb escritorio comparar="p1" />);
  await fireEvent.press(screen.getByLabelText('Agregar a la comparación'));
  expect(mockAlternar).toHaveBeenCalledWith('p1');
});

it('si ya está, lo dice y quita', async () => {
  Object.assign(mockC, { ids: ['p1'] });
  await render(<BarraFichaWeb escritorio comparar="p1" />);
  await fireEvent.press(screen.getByLabelText('Quitar de la comparación'));
  expect(mockAlternar).toHaveBeenCalledWith('p1');
});

it('con la lista llena avisa y NO agrega', async () => {
  Object.assign(mockC, { ids: ['a', 'b', 'c'], lleno: true });
  await render(<BarraFichaWeb escritorio comparar="p1" />);
  await fireEvent.press(screen.getByLabelText('La comparación está llena'));
  expect(mockAlternar).not.toHaveBeenCalled();
  expect(screen.getByText('Comparación llena (3)')).toBeTruthy();
});

it('con dos o más ofrece ver la comparación; con uno, no', async () => {
  Object.assign(mockC, { ids: ['a'] });
  const r = await render(<BarraFichaWeb escritorio comparar="p1" />);
  expect(screen.queryByLabelText(/Ver la comparación/)).toBeNull();
  Object.assign(mockC, { ids: ['a', 'b'] });
  await r.rerender(<BarraFichaWeb escritorio comparar="p1" />);
  await fireEvent.press(screen.getByLabelText('Ver la comparación de 2 lugares'));
  expect(mockPush).toHaveBeenCalledWith('/comparar');
});

it('sin la prop `comparar` (ficha de negocio) no aparece', async () => {
  await render(<BarraFichaWeb escritorio />);
  expect(screen.queryByText('Comparar')).toBeNull();
});
