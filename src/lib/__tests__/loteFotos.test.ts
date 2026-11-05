// Las tarjetas de una página piden su primera foto cada una; salen juntas en UNA llamada. Si la función aún no conoce los lotes se pide de una en una; otros fallos no se multiplican.

const mockLote = jest.fn();
const mockUna = jest.fn();
jest.mock('@/services/explorar.service', () => {
  class ErrorLoteNoSoportado extends Error {}
  return {
    ErrorLoteNoSoportado,
    fotosPublicasLote: (...a: unknown[]) => mockLote(...a),
    fotosPublicas: (...a: unknown[]) => mockUna(...a),
  };
});

import { ErrorLoteNoSoportado } from '@/services/explorar.service';
import { VENTANA_LOTE_MS, primeraFoto } from '../loteFotos';

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

const pasarVentana = () => jest.advanceTimersByTimeAsync(VENTANA_LOTE_MS + 1);

it('junta las peticiones de la misma ventana en UNA llamada y reparte a cada quien lo suyo', async () => {
  mockLote.mockResolvedValue({ a: ['fa'], b: ['fb'] });
  const pa = primeraFoto('publicacion', 'a');
  const pb = primeraFoto('publicacion', 'b');
  await pasarVentana();
  expect(await pa).toEqual(['fa']);
  expect(await pb).toEqual(['fb']);
  expect(mockLote).toHaveBeenCalledTimes(1);
  expect(mockLote).toHaveBeenCalledWith('publicacion', ['a', 'b']);
});

it('lo que no viene en la respuesta (no visible, sin fotos) es [] y no un fallo', async () => {
  mockLote.mockResolvedValue({});
  const p = primeraFoto('negocio', 'x');
  await pasarVentana();
  expect(await p).toEqual([]);
});

it('el mismo id pedido dos veces va una sola vez y responde a las dos', async () => {
  mockLote.mockResolvedValue({ a: ['fa'] });
  const p1 = primeraFoto('publicacion', 'a');
  const p2 = primeraFoto('publicacion', 'a');
  await pasarVentana();
  expect(await p1).toEqual(['fa']);
  expect(await p2).toEqual(['fa']);
  expect(mockLote).toHaveBeenCalledWith('publicacion', ['a']);
});

it('tipos distintos van en llamadas distintas', async () => {
  mockLote.mockResolvedValue({});
  const p1 = primeraFoto('publicacion', 'a');
  const p2 = primeraFoto('negocio', 'b');
  await pasarVentana();
  await Promise.all([p1, p2]);
  expect(mockLote).toHaveBeenCalledTimes(2);
});

it('con más de 50, sale en más de un lote', async () => {
  mockLote.mockResolvedValue({});
  const ps = Array.from({ length: 51 }, (_, i) => primeraFoto('publicacion', `id${i}`));
  await pasarVentana();
  await Promise.all(ps);
  expect(mockLote).toHaveBeenCalledTimes(2);
  expect(mockLote.mock.calls[0][1]).toHaveLength(50);
});

it('si la función aún no conoce los lotes, vuelve a pedir de una en una y entrega la primera foto', async () => {
  mockLote.mockRejectedValue(new ErrorLoteNoSoportado());
  mockUna.mockImplementation(async (_t: string, id: string) => [`${id}-1`, `${id}-2`]);
  const pa = primeraFoto('publicacion', 'a');
  const pb = primeraFoto('publicacion', 'b');
  await pasarVentana();
  expect(await pa).toEqual(['a-1']);
  expect(await pb).toEqual(['b-1']);
  expect(mockUna).toHaveBeenCalledTimes(2);
});

it('cualquier otro fallo llega a cada tarjeta como fallo y NO se multiplica en llamadas sueltas', async () => {
  mockLote.mockRejectedValue(new Error('500'));
  const pa = primeraFoto('publicacion', 'a');
  const pb = primeraFoto('publicacion', 'b');
  const resultados = Promise.allSettled([pa, pb]);
  await pasarVentana();
  const r = await resultados;
  expect(r.map((x) => x.status)).toEqual(['rejected', 'rejected']);
  expect(mockUna).not.toHaveBeenCalled();
});
