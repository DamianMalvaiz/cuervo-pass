import { fireEvent, render, screen } from '@testing-library/react-native';

// Un lugar de «Cerca de tu universidad» en la app: lo que enseña la vista pública, la cercanía rotulada, y abre su ficha.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useExplorar', () => ({ useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }) }));

import { FilaLugarPublico } from '../FilaLugarPublico';

const p = { id: 'abc', titulo_publico: 'Cuarto en Centro', tipo: 'cuarto', precio_renta: 2900, zona: 'Centro, Lerma, México', recamaras: 1, amueblado: true, num_fotos: 0 } as never;

beforeEach(() => jest.clearAllMocks());

it('enseña título, zona, precio y la cercanía como estimación', async () => {
  await render(<FilaLugarPublico p={p} km={0.4} />);
  expect(screen.getByText('Cuarto en Centro')).toBeTruthy();
  expect(screen.getByText('$2,900 al mes')).toBeTruthy();
  expect(screen.getByText('a menos de 1 km · ~5 min a pie')).toBeTruthy();
});

it('más allá de 3 km lo dice en bici, no a pie', async () => {
  await render(<FilaLugarPublico p={p} km={4.2} />);
  expect(screen.getByText(/en bici/)).toBeTruthy();
  expect(screen.queryByText(/a pie/)).toBeNull();
});

it('tocarla abre la ficha de la app', async () => {
  await render(<FilaLugarPublico p={p} km={1.2} />);
  await fireEvent.press(screen.getByLabelText(/^Cuarto en Centro,/));
  expect(mockPush).toHaveBeenCalledWith('/publicacion/abc');
});

it('sin `km` (Vistos, Comparar) no hay línea de cercanía ni se inventa una', async () => {
  await render(<FilaLugarPublico p={p} />);
  expect(screen.getByText('Cuarto en Centro')).toBeTruthy();
  expect(screen.queryByText(/a pie|en bici|km/)).toBeNull();
  expect(screen.getByLabelText('Cuarto en Centro, 2,900 pesos al mes')).toBeTruthy();
});
