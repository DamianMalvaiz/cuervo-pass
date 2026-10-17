import { render, screen } from '@testing-library/react-native';

// «N personas la guardaron» · Cuervo 360. Se ve el número y nunca quién.
//
// El conteo es una señal secundaria: si todavía carga, si falla o si es cero, NO se pinta nada.
// Mostrar «0 personas la guardaron» por un fallo de red diría algo falso (END-11), y un cero de
// verdad no aporta nada que decir.

const mockConteo = jest.fn();
jest.mock('@/hooks/queries/useFavoritos', () => ({ useConteoFavoritos: (...a: unknown[]) => mockConteo(...a) }));

import { ConteoFavoritos } from '../ConteoFavoritos';

const con = (mapa: Record<string, number>, extra: Record<string, unknown> = {}) =>
  mockConteo.mockReturnValue({ conteos: new Map(Object.entries(mapa)), cargando: false, fallo: false, ...extra });

beforeEach(() => jest.clearAllMocks());

test('pide el conteo de ESTA publicación', async () => {
  con({ p1: 3 });
  await render(<ConteoFavoritos publicacionId="p1" />);
  expect(mockConteo).toHaveBeenCalledWith(['p1']);
});

test('con una persona usa el singular', async () => {
  con({ p1: 1 });
  await render(<ConteoFavoritos publicacionId="p1" />);
  expect(await screen.findByText('1 persona la guardó')).toBeTruthy();
});

test('con varias usa el plural', async () => {
  con({ p1: 12 });
  await render(<ConteoFavoritos publicacionId="p1" />);
  expect(await screen.findByText('12 personas la guardaron')).toBeTruthy();
});

test('con cero no pinta nada', async () => {
  con({ p1: 0 });
  await render(<ConteoFavoritos publicacionId="p1" />);
  expect(screen.queryByText(/la guard/)).toBeNull();
});

test('si falla no pinta nada y NO afirma un cero', async () => {
  con({}, { fallo: true });
  await render(<ConteoFavoritos publicacionId="p1" />);
  expect(screen.queryByText(/guard/)).toBeNull();
});

test('mientras carga no pinta nada', async () => {
  con({}, { cargando: true });
  await render(<ConteoFavoritos publicacionId="p1" />);
  expect(screen.queryByText(/guard/)).toBeNull();
});

test('sin fila para esta publicación (no se puede ver) no pinta nada', async () => {
  con({ otra: 5 });
  await render(<ConteoFavoritos publicacionId="p1" />);
  expect(screen.queryByText(/guard/)).toBeNull();
});
