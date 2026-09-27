import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

// La suscripción de Realtime vista desde el hook · END-18
//
// `suscribirseAMisChats` ya tiene sus propias pruebas en el servicio: abre el
// canal, escucha los dos eventos y devuelve un limpiador que lo cierra. Lo que
// NADIE comprobaba es que este hook LLAME a ese limpiador.
//
// La cola de trabajo decía «probarlo en `chats.tsx`». Estaba mal ubicado: la
// pantalla no se suscribe a nada —la suscripción se mudó aquí con END-18—, así
// que una prueba en la pantalla habría comprobado el mock del hook y habría
// pasado en verde con la fuga intacta. Corregido: va donde está el `useEffect`.
//
// Por qué importa: un canal que no se cierra al desmontar no rompe nada
// visible. Solo deja un websocket abierto por cada vez que se entró a la
// pestaña, todos recibiendo el mismo evento e invalidando la misma consulta. Con
// la app abierta media hora son una docena, y el único síntoma es que la batería
// baja más rápido. Nadie lo atribuye nunca a esto.

const mockListar = jest.fn();
const mockSuscribir = jest.fn();
const mockLimpiar = jest.fn();

jest.mock('@/services/mensajes.service', () => ({
  listarConversaciones: (...a: unknown[]) => mockListar(...a),
  suscribirseAMisChats: (...a: unknown[]) => mockSuscribir(...a),
}));

import { clienteDePrueba } from '@pruebas/consultas';
import { useConversaciones } from '@/hooks/queries/useChat';

const envolver = (extra?: Parameters<typeof clienteDePrueba>[0]) => {
  const cliente = clienteDePrueba(extra);
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return { Envoltura, cliente };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListar.mockResolvedValue([]);
  mockSuscribir.mockReturnValue(mockLimpiar);
});

// LA prueba de este archivo.
//
// `unmount()` va dentro de `act`, y no es adorno: medido con una sonda en este
// arnés, `unmount()` a secas corre el desmontaje pero NO vacía los limpiadores
// de efecto —el contador se queda en 0—, y el limpiador pendiente se vacía en el
// siguiente `act` del archivo. De ahí que un `unmount()` desnudo no solo falle
// su propia aserción: envenena los renders posteriores del mismo archivo, que
// devuelven `result.current` null. Es la causa de la nota de ordenación que hay
// en `consultas.test.tsx`, y la cura es esta, no colocar la prueba al final.
test('al desmontar, cierra la suscripción', async () => {
  const { Envoltura } = envolver();
  const vista = await renderHook(() => useConversaciones('u1'), { wrapper: Envoltura });

  await waitFor(() => expect(mockSuscribir).toHaveBeenCalledTimes(1));
  expect(mockLimpiar).not.toHaveBeenCalled();

  await act(async () => {
    vista.unmount();
  });
  expect(mockLimpiar).toHaveBeenCalledTimes(1);
});

// Una sola suscripción por montaje. Si el efecto se re-ejecutara en cada render
// —por una dependencia inestable, que es el error clásico— habría un canal
// nuevo por render y el desmontaje solo cerraría el último.
test('se suscribe una sola vez, no una por render', async () => {
  const { Envoltura } = envolver();
  const { rerender } = await renderHook(() => useConversaciones('u1'), { wrapper: Envoltura });
  await waitFor(() => expect(mockSuscribir).toHaveBeenCalledTimes(1));

  await act(async () => {
    rerender({});
    rerender({});
  });
  expect(mockSuscribir).toHaveBeenCalledTimes(1);
});

// Sin sesión no hay a qué suscribirse, y suscribirse igual dejaría un canal
// escuchando los mensajes de todo el mundo.
test('sin usuario no se suscribe', async () => {
  const { Envoltura } = envolver();
  await renderHook(() => useConversaciones(undefined), { wrapper: Envoltura });
  expect(mockSuscribir).not.toHaveBeenCalled();
  expect(mockListar).not.toHaveBeenCalled();
});

// Cambiar de cuenta cierra el canal anterior ANTES de abrir el nuevo. Si no, la
// cuenta vieja seguiría recibiendo eventos: una fuga y además una fuga de datos
// entre sesiones.
test('al cambiar de usuario cierra el canal anterior y abre otro', async () => {
  const { Envoltura } = envolver();
  const { rerender } = await renderHook(({ id }: { id: string }) => useConversaciones(id), {
    wrapper: Envoltura,
    initialProps: { id: 'u1' },
  });
  await waitFor(() => expect(mockSuscribir).toHaveBeenCalledTimes(1));

  await act(async () => {
    rerender({ id: 'u2' });
  });
  await waitFor(() => expect(mockSuscribir).toHaveBeenCalledTimes(2));
  expect(mockLimpiar).toHaveBeenCalledTimes(1);
});

// La línea 34, que estaba sin cubrir: lo que hace el aviso de Realtime.
//
// Invalidar y NO recargar a mano es el punto de END-18: `invalidateQueries` deja
// `data` intacta mientras refresca, así que la lista no parpadea ni pierde el
// scroll. Recargar a mano vaciaba el arreglo primero.
test('el aviso de Realtime invalida la consulta, no la recarga a pelo', async () => {
  const { Envoltura } = envolver();
  await renderHook(() => useConversaciones('u1'), { wrapper: Envoltura });
  await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(1));

  // Disparar el callback que el hook le pasó al servicio: es lo que hace
  // Realtime al llegar un mensaje.
  const avisar = mockSuscribir.mock.calls[0][0] as () => void;
  await act(async () => {
    avisar();
  });

  await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(2));
});

// El aviso invalida LA clave de este usuario. Si invalidara una clave genérica,
// funcionaría por casualidad hoy y dejaría de funcionar al añadir otra consulta
// de conversaciones.
test('invalida la clave del usuario, no una genérica', async () => {
  const { Envoltura, cliente } = envolver();
  await renderHook(() => useConversaciones('u1'), { wrapper: Envoltura });
  await waitFor(() => expect(cliente.getQueryState(['conversaciones', 'u1'])).toBeTruthy());

  const avisar = mockSuscribir.mock.calls[0][0] as () => void;
  await act(async () => {
    avisar();
  });

  await waitFor(() => expect(cliente.getQueryState(['conversaciones', 'u1'])?.isInvalidated ?? false).toBe(false));
  expect(mockListar).toHaveBeenCalledWith('u1');
});

// §27 · Un fallo no puede presentarse como lista vacía.
// El backoff se acorta a 1 ms: lo que se comprueba es que el fallo SE DIGA, no
// cuánto espera un reintento —eso lo fija `crearClienteConsultas` y ya tiene su
// prueba—. Con los mil y dos mil milisegundos de verdad, esta sola prueba tarda
// tres segundos y deja temporizadores vivos que impiden a Jest cerrar. V.7 otra
// vez, en pequeño.
test('un fallo se dice y no se disfraza de cero conversaciones', async () => {
  mockListar.mockRejectedValue(new Error('caido'));
  const { Envoltura } = envolver({ queries: { retryDelay: 1 } });
  const { result } = await renderHook(() => useConversaciones('u1'), {
    wrapper: Envoltura,
  });
  await waitFor(() => expect(result.current.fallo).toBe('No pudimos cargar tus conversaciones.'));
  expect(result.current.conversaciones).toEqual([]);
});
