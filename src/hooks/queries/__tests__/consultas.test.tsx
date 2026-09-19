import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

// END-18 · Antes cada pantalla de lista era `useState` + `useFocusEffect`. Sin
// caché, sin deduplicación, sin reintento, sin backoff. Cada regreso desde el
// detalle reconsultaba el motor COMPLETO y reemplazaba el arreglo entero:
// parpadeo y pérdida del scroll.
//
// Estas pruebas no comprueban que los datos lleguen —eso ya lo cubren las del
// servicio— sino las tres propiedades que no existían.

const mockObtenerSugerencias = jest.fn();
const mockObtenerPublicacion = jest.fn();

jest.mock('@/services/publicaciones.service', () => ({
  obtenerSugerencias: (...a: unknown[]) => mockObtenerSugerencias(...a),
  obtenerPublicacionPublica: (...a: unknown[]) => mockObtenerPublicacion(...a),
  listarMisPublicaciones: jest.fn(),
  contarContactosRecibidos: jest.fn(),
}));

import { crearClienteConsultas } from '@/lib/consultas';
import { usePublicacion, useSugerencias } from '@/hooks/queries/usePublicaciones';

const envolver = (cliente = crearClienteConsultas()) => {
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return { Envoltura, cliente };
};

const RESPUESTA = { datos: [{ id: 'p1' }], conAfinidad: 1, total: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  mockObtenerSugerencias.mockResolvedValue(RESPUESTA);
  mockObtenerPublicacion.mockResolvedValue({ id: 'p1', titulo: 'Depa' });
});

test('devuelve los datos del servicio', async () => {
  const { Envoltura } = envolver();
  const { result } = await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  await waitFor(() => expect(result.current.datos).toHaveLength(1));
  expect(result.current.conAfinidad).toBe(1);
});

// LA propiedad que no existía. Dos consumidores de lo mismo, una sola petición.
test('deduplica: dos hooks con la misma clave consultan una vez', async () => {
  const { Envoltura } = envolver();
  const a = await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  const b = await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  await waitFor(() => expect(a.result.current.datos).toHaveLength(1));
  await waitFor(() => expect(b.result.current.datos).toHaveLength(1));
  expect(mockObtenerSugerencias).toHaveBeenCalledTimes(1);
});

// Cambiar de chip es otra clave: sí debe consultar, y además queda cacheado por
// chip, que es caché gratis al volver al anterior.
test('cada tipo es su propia clave', async () => {
  const { Envoltura, cliente } = envolver();
  await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  await waitFor(() => expect(cliente.getQueryData(['sugerencias', null])).toBeTruthy());
  await renderHook(() => useSugerencias('cuarto'), { wrapper: Envoltura });
  await waitFor(() => expect(cliente.getQueryData(['sugerencias', 'cuarto'])).toBeTruthy());
  expect(mockObtenerSugerencias).toHaveBeenCalledTimes(2);
});

// El backoff se acorta a 1 ms: lo que se comprueba es que REINTENTE, no cuánto
// espera — eso lo fija `crearClienteConsultas` y no hay que pagarlo en segundos
// en cada corrida.
const clienteRapido = () => crearClienteConsultas({ queries: { retryDelay: 1 } });

// Un fallo transitorio de red dejaba la pantalla vacía hasta que alguien
// deslizara. Con reintento, se resuelve solo.
test('un fallo transitorio se reintenta y termina en verde', async () => {
  mockObtenerSugerencias
    .mockRejectedValueOnce(new Error('network request failed'))
    .mockResolvedValue(RESPUESTA);
  const { Envoltura, cliente } = envolver(clienteRapido());
  await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  await waitFor(() => expect(mockObtenerSugerencias).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(cliente.getQueryData(['sugerencias', null])).toBeTruthy());
});

// Y si falla de verdad, se dice. §27: un fallo no puede presentarse como lista
// vacía — es el mismo defecto que END-11 en otra capa.
test('un fallo definitivo reintenta lo declarado y no deja datos', async () => {
  mockObtenerSugerencias.mockRejectedValue(new Error('caido'));
  const { Envoltura, cliente } = envolver(clienteRapido());
  await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  // Tres intentos: el original más los dos reintentos declarados.
  await waitFor(() => expect(mockObtenerSugerencias).toHaveBeenCalledTimes(3));
  expect(cliente.getQueryData(['sugerencias', null])).toBeUndefined();
  expect(cliente.getQueryState(['sugerencias', null])?.status).toBe('error');
});

test('usePublicacion no consulta sin id', async () => {
  const { Envoltura } = envolver();
  await renderHook(() => usePublicacion(undefined), { wrapper: Envoltura });
  await new Promise((r) => setTimeout(r, 50));
  expect(mockObtenerPublicacion).not.toHaveBeenCalled();
});

// ── Esta prueba va LA ÚLTIMA del archivo, y no por gusto ──
//
// Llama a `unmount()` explícitamente, y en este arnés eso deja sin pintar a
// TODO render posterior del mismo archivo: `result.current` llega null y las
// consultas ni se disparan. Comprobado: aislada pasa; colocada en medio, las
// tres siguientes fallan; movida al final, las siete pasan.
//
// Esto explica además el misterio de FormularioPublicacion, donde hubo que
// partir las pruebas de envío a otro archivo sin entender por qué: aquel
// archivo tiene `afterEach(cleanup)`, que es un unmount explícito. Queda
// pendiente comprobar si quitarlo permite volver a juntarlos.
//
// Volver del detalle a la lista dentro del staleTime no debe reconsultar.
test('dentro del staleTime, remontar NO vuelve a consultar', async () => {
  const { Envoltura, cliente } = envolver();
  const primero = await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  await waitFor(() => expect(primero.result.current.datos).toHaveLength(1));
  primero.unmount();

  const segundo = await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  await waitFor(() => expect(segundo.result.current.datos).toHaveLength(1));
  expect(mockObtenerSugerencias).toHaveBeenCalledTimes(1);
  expect(cliente.getQueryData(['sugerencias', null])).toBeTruthy();
});
