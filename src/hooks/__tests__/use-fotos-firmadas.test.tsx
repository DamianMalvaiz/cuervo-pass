import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

// END-24 · Las URLs firmadas caducan a la hora y se firmaban UNA sola vez, al
// montar. Una app abierta más de sesenta minutos se queda sin ninguna foto —
// todas en 403— y no se recupera nunca: el efecto ya corrió y no vuelve a
// correr mientras la pantalla siga montada.
//
// No es un caso raro. Alguien que deja la app abierta mientras come, o el
// teléfono conectado durante una exposición, lo ve.

const mockFirmarRutas = jest.fn();
jest.mock('@/lib/storage', () => ({
  firmarRutas: (...a: unknown[]) => mockFirmarRutas(...a),
  CADUCIDAD_SEGUNDOS: 3600,
}));

import { crearClienteConsultas } from '@/lib/consultas';
import { INTERVALO_REFIRMA_MS, useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { CADUCIDAD_SEGUNDOS } from '@/lib/storage';

const envolver = (cliente = crearClienteConsultas()) => {
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return { Envoltura, cliente };
};

const mapa = (pares: [string, string][]) => new Map(pares);

beforeEach(() => {
  jest.clearAllMocks();
  mockFirmarRutas.mockResolvedValue({ estado: 'ok', datos: mapa([['a.jpg', 'https://firmada/a']]) });
});

// LA invariante. El intervalo tiene que dejar margen ANTES de la caducidad: si
// coincidieran, la refirma llegaría justo cuando las URLs ya no sirven.
test('la refirma ocurre con margen antes de que caduquen', () => {
  expect(INTERVALO_REFIRMA_MS).toBeLessThan(CADUCIDAD_SEGUNDOS * 1000);
  // Al menos cinco minutos de holgura, para redes lentas y reintentos.
  expect(CADUCIDAD_SEGUNDOS * 1000 - INTERVALO_REFIRMA_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
});

test('devuelve las urls firmadas', async () => {
  const { Envoltura } = envolver();
  const { result } = await renderHook(() => useFotosFirmadas(['a.jpg']), { wrapper: Envoltura });
  await waitFor(() => expect(result.current.urls.get('a.jpg')).toBe('https://firmada/a'));
});

test('sin rutas no pide nada', async () => {
  const { Envoltura } = envolver();
  await renderHook(() => useFotosFirmadas([]), { wrapper: Envoltura });
  await new Promise((r) => setTimeout(r, 30));
  expect(mockFirmarRutas).not.toHaveBeenCalled();
});

// Dos pantallas pidiendo las mismas fotos son UNA petición firmada, no dos.
test('deduplica entre consumidores con las mismas rutas', async () => {
  const { Envoltura } = envolver();
  const a = await renderHook(() => useFotosFirmadas(['a.jpg']), { wrapper: Envoltura });
  const b = await renderHook(() => useFotosFirmadas(['a.jpg']), { wrapper: Envoltura });
  await waitFor(() => expect(a.result.current.urls.size).toBe(1));
  await waitFor(() => expect(b.result.current.urls.size).toBe(1));
  expect(mockFirmarRutas).toHaveBeenCalledTimes(1);
});

// END-25 · Un fallo de Storage se DICE, no se presenta como «sin fotos».
test('un fallo de Storage llega a quien pinta', async () => {
  mockFirmarRutas.mockResolvedValue({ estado: 'error', mensaje: 'No pudimos cargar las fotos.' });
  const { Envoltura } = envolver();
  const { result } = await renderHook(() => useFotosFirmadas(['a.jpg']), { wrapper: Envoltura });
  await waitFor(() => expect(result.current.fallo).toBeTruthy());
});

// Las URLs que ya funcionaban NO se borran por un fallo posterior: perder las
// fotos visibles por un refresco fallido es el mismo defecto que END-11.
test('un fallo posterior no borra las urls que ya habia', async () => {
  const { Envoltura, cliente } = envolver();
  const { result } = await renderHook(() => useFotosFirmadas(['a.jpg']), { wrapper: Envoltura });
  await waitFor(() => expect(result.current.urls.size).toBe(1));

  mockFirmarRutas.mockResolvedValue({ estado: 'error', mensaje: 'cayó' });
  await cliente.refetchQueries();
  expect(result.current.urls.get('a.jpg')).toBe('https://firmada/a');
});

// El orden de las rutas no debe partir la caché: la misma lista desordenada es
// la misma consulta.
test('el orden de las rutas no cambia la clave', async () => {
  const { Envoltura } = envolver();
  await renderHook(() => useFotosFirmadas(['a.jpg', 'b.jpg']), { wrapper: Envoltura });
  await waitFor(() => expect(mockFirmarRutas).toHaveBeenCalledTimes(1));
  await renderHook(() => useFotosFirmadas(['b.jpg', 'a.jpg']), { wrapper: Envoltura });
  await new Promise((r) => setTimeout(r, 30));
  expect(mockFirmarRutas).toHaveBeenCalledTimes(1);
});
