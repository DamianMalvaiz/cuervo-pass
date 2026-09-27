import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
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

import { clienteDePrueba } from '@pruebas/consultas';
import { usePublicacion, useSugerencias } from '@/hooks/queries/usePublicaciones';

// V.7 · `staleTime` de un segundo, no los treinta de producción.
//
// Estas pruebas comprueban que DENTRO del staleTime no se reconsulta, y sus
// aserciones ocurren en milisegundos: treinta segundos y uno demuestran lo
// mismo. La diferencia es que un `staleTime` de 30 s deja un temporizador vivo
// que cuelga el proceso treinta segundos tras pasar las ocho pruebas —medido
// el 26/09/2026: 31.26 s de reloj para 0.8 s de pruebas.
const envolver = (cliente = clienteDePrueba({ queries: { staleTime: 1000 } })) => {
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

// ── Por qué el `unmount()` va dentro de `act` ──
//
// Esta prueba estuvo LA ÚLTIMA del archivo con una nota que decía que tenía que
// estarlo: llamaba a `unmount()` a secas, y eso dejaba sin pintar a todo render
// posterior del mismo archivo —`result.current` llegaba null y las consultas ni
// se disparaban—. Se comprobó entonces: aislada pasaba, en medio tumbaba a las
// tres siguientes, al final las siete pasaban. La conclusión que saqué fue
// «colócala al final», y era tratar el síntoma.
//
// La causa, medida con una sonda el 26/09/2026 al escribir las pruebas de
// `useChat`: en este arnés `unmount()` desmonta pero NO vacía los limpiadores de
// efecto. El limpiador se queda pendiente y se vacía dentro del SIGUIENTE `act`
// del archivo —la sonda lo vio contar 2 donde debía contar 1—, y ese vaciado a
// destiempo es lo que rompe los renders de en medio.
//
// Con `act` alrededor del `unmount` la restricción desaparece: esta prueba está
// ahora en segundo lugar y las ocho pasan. Queda escrito porque la regla vieja
// («las pruebas con unmount van al final») habría ido creciendo por el
// repositorio sin que nadie supiera por qué.
//
// Y deja una pregunta ya contestable: `FormularioPublicacion` tuvo que partir
// sus pruebas de envío a otro archivo sin que se entendiera el motivo, y aquel
// archivo tiene `afterEach(cleanup)` —un unmount explícito—. Anotado en la cola.
//
// Volver del detalle a la lista dentro del staleTime no debe reconsultar.
test('dentro del staleTime, remontar NO vuelve a consultar', async () => {
  // `gcTime: Infinity` y no el 0 por omisión: esta prueba existe para comprobar
  // que el dato SOBREVIVE al desmontaje, y con recolección inmediata pasaría
  // por casualidad —la consulta se descarta y se vuelve a pedir tan rápido que
  // el conteo podría cuadrar igual—. Infinity retiene y, por ser infinito, no
  // agenda ningún temporizador.
  const { Envoltura, cliente } = envolver(clienteDePrueba({ queries: { staleTime: 1000, gcTime: Infinity } }));
  const primero = await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  await waitFor(() => expect(primero.result.current.datos).toHaveLength(1));
  await act(async () => {
    primero.unmount();
  });

  const segundo = await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  await waitFor(() => expect(segundo.result.current.datos).toHaveLength(1));
  expect(mockObtenerSugerencias).toHaveBeenCalledTimes(1);
  expect(cliente.getQueryData(['sugerencias', null, 'ajuste'])).toBeTruthy();
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
  await waitFor(() => expect(cliente.getQueryData(['sugerencias', null, 'ajuste'])).toBeTruthy());
  await renderHook(() => useSugerencias('cuarto'), { wrapper: Envoltura });
  await waitFor(() => expect(cliente.getQueryData(['sugerencias', 'cuarto', 'ajuste'])).toBeTruthy());
  expect(mockObtenerSugerencias).toHaveBeenCalledTimes(2);
});

// END-32 · Y cada ORDEN tambien. Si el orden no entrara en la clave, cambiarlo
// reutilizaria la respuesta anterior y el control no haria nada visible hasta
// que la cache caducara — que es literalmente lo que le paso al chip de tipo
// entre C.3 y B.3.
test('cada orden es su propia clave', async () => {
  const { Envoltura, cliente } = envolver();
  await renderHook(() => useSugerencias(null, 'ajuste'), { wrapper: Envoltura });
  await waitFor(() => expect(cliente.getQueryData(['sugerencias', null, 'ajuste'])).toBeTruthy());
  await renderHook(() => useSugerencias(null, 'precio'), { wrapper: Envoltura });
  await waitFor(() => expect(cliente.getQueryData(['sugerencias', null, 'precio'])).toBeTruthy());
  expect(mockObtenerSugerencias).toHaveBeenCalledTimes(2);
});

// El backoff se acorta a 1 ms: lo que se comprueba es que REINTENTE, no cuánto
// espera — eso lo fija `crearClienteConsultas` y no hay que pagarlo en segundos
// en cada corrida.
const clienteRapido = () => clienteDePrueba({ queries: { retryDelay: 1 } });

// Un fallo transitorio de red dejaba la pantalla vacía hasta que alguien
// deslizara. Con reintento, se resuelve solo.
test('un fallo transitorio se reintenta y termina en verde', async () => {
  mockObtenerSugerencias
    .mockRejectedValueOnce(new Error('network request failed'))
    .mockResolvedValue(RESPUESTA);
  const { Envoltura, cliente } = envolver(clienteRapido());
  await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  await waitFor(() => expect(mockObtenerSugerencias).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(cliente.getQueryData(['sugerencias', null, 'ajuste'])).toBeTruthy());
});

// Y si falla de verdad, se dice. §27: un fallo no puede presentarse como lista
// vacía — es el mismo defecto que END-11 en otra capa.
test('un fallo definitivo reintenta lo declarado y no deja datos', async () => {
  mockObtenerSugerencias.mockRejectedValue(new Error('caido'));
  const { Envoltura, cliente } = envolver(clienteRapido());
  await renderHook(() => useSugerencias(null), { wrapper: Envoltura });
  // Tres intentos: el original más los dos reintentos declarados.
  await waitFor(() => expect(mockObtenerSugerencias).toHaveBeenCalledTimes(3));
  expect(cliente.getQueryData(['sugerencias', null, 'ajuste'])).toBeUndefined();
  expect(cliente.getQueryState(['sugerencias', null, 'ajuste'])?.status).toBe('error');
});

test('usePublicacion no consulta sin id', async () => {
  const { Envoltura } = envolver();
  await renderHook(() => usePublicacion(undefined), { wrapper: Envoltura });
  await new Promise((r) => setTimeout(r, 50));
  expect(mockObtenerPublicacion).not.toHaveBeenCalled();
});

