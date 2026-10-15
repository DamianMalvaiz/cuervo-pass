// El toast propio · paso 1 · lo que se ve.
//
// El host se monta una vez en el layout raíz y pinta el aviso actual del store.
// Lo que estas pruebas protegen no es cómo se ve —eso se juzga en un
// dispositivo—, sino lo que un aviso mal hecho rompe en silencio: que no
// desaparezca nunca, que desaparezca antes de poder leerse, que el temporizador
// de uno viejo borre el nuevo, o que quien usa lector de pantalla no se entere.

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

jest.mock('@/hooks/use-movimiento-reducido', () => ({ useMovimientoReducido: () => false }));

import { ToastHost } from '@/components/ToastHost';
import { toast } from '@/lib/toast';
import { DURACION_MS, useToastStore } from '@/store/useToastStore';

const avanzar = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(() => {
  jest.useFakeTimers();
  useToastStore.setState({ actual: null });
  // `announceForAccessibility` ya es un jest.fn de jest-expo, así que `spyOn` lo
  // devuelve tal cual y `restoreAllMocks` NO le limpia el contador: sin esto las
  // llamadas de una prueba se suman a las de la siguiente.
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  (AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('sin aviso no pinta nada', async () => {
  await render(<ToastHost />);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.toJSON()).toBeNull();
});

test('muestra el mensaje del aviso actual', async () => {
  await render(<ToastHost />);
  await act(async () => {
    toast.exito('Publicación guardada');
  });
  expect(screen.getByText('Publicación guardada')).toBeTruthy();
});

test('un éxito se cierra solo al cumplirse su duración', async () => {
  await render(<ToastHost />);
  await act(async () => {
    toast.exito('Guardado');
  });

  await avanzar(DURACION_MS.exito - 1);
  expect(screen.getByText('Guardado')).toBeTruthy();

  await avanzar(1);
  expect(screen.queryByText('Guardado')).toBeNull();
});

// Un aviso que desaparece antes de poder leerse no avisó.
test('un error sigue en pantalla cuando un éxito ya se habría ido', async () => {
  await render(<ToastHost />);
  await act(async () => {
    toast.error('No se pudo guardar');
  });

  await avanzar(DURACION_MS.exito + 500);
  expect(screen.getByText('No se pudo guardar')).toBeTruthy();

  await avanzar(DURACION_MS.error);
  expect(screen.queryByText('No se pudo guardar')).toBeNull();
});

test('tocarlo lo cierra', async () => {
  await render(<ToastHost />);
  await act(async () => {
    toast.error('No se pudo guardar');
  });

  await fireEvent.press(screen.getByText('No se pudo guardar'));
  expect(screen.queryByText('No se pudo guardar')).toBeNull();
});

// LA prueba del temporizador. Sin la guarda por id, el cierre automático del
// primero borraría el segundo a medio leer.
test('el temporizador de un aviso viejo no se lleva al nuevo', async () => {
  await render(<ToastHost />);
  await act(async () => {
    toast.exito('Primero');
  });
  await avanzar(2000);

  await act(async () => {
    toast.exito('Segundo');
  });
  // Ya pasó la duración del primero, pero no la del segundo.
  await avanzar(1500);
  expect(screen.queryByText('Primero')).toBeNull();
  expect(screen.getByText('Segundo')).toBeTruthy();

  await avanzar(1500);
  expect(screen.queryByText('Segundo')).toBeNull();
});

// Repetir el mismo mensaje —tocar «Guardar» dos veces— reinicia el tiempo en vez
// de cortar el aviso a mitad.
test('repetir el mismo mensaje reinicia su temporizador', async () => {
  await render(<ToastHost />);
  await act(async () => {
    toast.exito('Guardado');
  });
  await avanzar(2000);
  await act(async () => {
    toast.exito('Guardado');
  });

  await avanzar(2000);
  expect(screen.getByText('Guardado')).toBeTruthy();
  await avanzar(1000);
  expect(screen.queryByText('Guardado')).toBeNull();
});

describe('accesibilidad', () => {
  test('un error es una alerta para el lector de pantalla', async () => {
    await render(<ToastHost />);
    await act(async () => {
      toast.error('No se pudo guardar');
    });
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  // `accessibilityLiveRegion` solo lo respeta Android. En iOS el anuncio tiene que
  // pedirse a mano, o VoiceOver nunca se entera de que apareció algo.
  test('se anuncia al lector de pantalla', async () => {
    await render(<ToastHost />);
    await act(async () => {
      toast.exito('Publicación guardada');
    });
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Publicación guardada');
  });

  test('el mismo aviso no se anuncia dos veces por un re-render', async () => {
    const { rerender } = await render(<ToastHost />);
    await act(async () => {
      toast.exito('Guardado');
    });
    await rerender(<ToastHost />);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
  });
});
