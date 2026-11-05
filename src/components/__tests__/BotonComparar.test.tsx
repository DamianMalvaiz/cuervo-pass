import { fireEvent, render, screen } from '@testing-library/react-native';

// «Comparar» en la ficha de la app: agrega y quita, avisa (no calla) con la lista llena, y con dos o más ofrece ir a verla.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const mockAlternar = jest.fn();
const mockEstado = { ids: [] as string[], lleno: false };
jest.mock('@/hooks/use-comparar', () => ({ useComparar: () => ({ ids: mockEstado.ids, lleno: mockEstado.lleno, alternar: mockAlternar }) }));

import { BotonComparar } from '../BotonComparar';

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockEstado, { ids: [], lleno: false });
});

it('«Comparar» agrega esta vivienda', async () => {
  await render(<BotonComparar id="a" />);
  await fireEvent.press(screen.getByLabelText('Agregar a la comparación'));
  expect(mockAlternar).toHaveBeenCalledWith('a');
});

it('si ya está, lo dice y tocarlo la quita', async () => {
  Object.assign(mockEstado, { ids: ['a'] });
  await render(<BotonComparar id="a" />);
  expect(screen.getByText('En la comparación')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Quitar de la comparación'));
  expect(mockAlternar).toHaveBeenCalledWith('a');
});

it('con la lista llena avisa y NO agrega', async () => {
  Object.assign(mockEstado, { ids: ['x', 'y', 'z'], lleno: true });
  await render(<BotonComparar id="a" />);
  expect(screen.getByText('Comparación llena (3)')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('La comparación está llena'));
  expect(mockAlternar).not.toHaveBeenCalled();
});

it('con la lista llena, la que YA está sí se puede quitar', async () => {
  Object.assign(mockEstado, { ids: ['a', 'y', 'z'], lleno: true });
  await render(<BotonComparar id="a" />);
  await fireEvent.press(screen.getByLabelText('Quitar de la comparación'));
  expect(mockAlternar).toHaveBeenCalledWith('a');
});

it('con una sola no ofrece «Ver comparación» (no hay con qué comparar); con dos o más sí, y lleva a /comparar', async () => {
  Object.assign(mockEstado, { ids: ['a'] });
  const { unmount } = await render(<BotonComparar id="a" />);
  expect(screen.queryByText(/Ver comparación/)).toBeNull();
  unmount();
  Object.assign(mockEstado, { ids: ['a', 'b'] });
  await render(<BotonComparar id="a" />);
  await fireEvent.press(screen.getByLabelText('Ver la comparación de 2 lugares'));
  expect(mockPush).toHaveBeenCalledWith('/comparar');
});
