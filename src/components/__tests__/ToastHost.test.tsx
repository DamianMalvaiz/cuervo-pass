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
import { DURACION_CON_ACCION_MS, DURACION_MS, useToastStore } from '@/store/useToastStore';

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

// ── Aviso con acción ─────────────────────────────────────────────────────────
// «Ajustes» en el aviso de permiso denegado. Un botón dentro de un aviso que se
// cierra solo tiene tres maneras de salir mal: que no se pueda alcanzar con un
// lector de pantalla, que tocarlo cierre sin hacer nada, o que desaparezca antes
// de poder pulsarlo.
describe('aviso con acción', () => {
  const conAccion = (onPress = jest.fn()) => {
    toast.error('Necesitamos permiso para acceder a tus fotos', {
      accion: { etiqueta: 'Ajustes', onPress },
    });
    return onPress;
  };

  test('muestra el botón con su etiqueta, junto al mensaje', async () => {
    await render(<ToastHost />);
    await act(async () => {
      conAccion();
    });

    expect(screen.getByText('Necesitamos permiso para acceder a tus fotos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ajustes' })).toBeTruthy();
  });

  test('sin acción no hay botón', async () => {
    await render(<ToastHost />);
    await act(async () => {
      toast.error('No se pudo guardar');
    });

    expect(screen.queryByRole('button')).toBeNull();
  });

  test('pulsar la acción la ejecuta UNA vez y cierra el aviso', async () => {
    await render(<ToastHost />);
    let onPress!: jest.Mock;
    await act(async () => {
      onPress = conAccion();
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Ajustes' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Necesitamos permiso para acceder a tus fotos')).toBeNull();
  });

  // El cuerpo cierra; solo el botón actúa. Si tocar el texto ejecutara la acción,
  // quien solo quiere quitar el aviso acabaría abriendo los Ajustes del teléfono.
  test('tocar el mensaje cierra el aviso SIN ejecutar la acción', async () => {
    await render(<ToastHost />);
    let onPress!: jest.Mock;
    await act(async () => {
      onPress = conAccion();
    });

    await fireEvent.press(screen.getByText('Necesitamos permiso para acceder a tus fotos'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByText('Necesitamos permiso para acceder a tus fotos')).toBeNull();
  });

  // La acción puede fallar (abrir Ajustes no es de fiar en todos los teléfonos).
  // Que falle no puede dejar un aviso colgado ni tumbar la pantalla.
  test('si la acción lanza, el aviso se cierra igual y no se propaga', async () => {
    await render(<ToastHost />);
    await act(async () => {
      conAccion(
        jest.fn(() => {
          throw new Error('no se pudo abrir');
        })
      );
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Ajustes' }));

    expect(screen.queryByText('Necesitamos permiso para acceder a tus fotos')).toBeNull();
  });

  // Un aviso con botón obliga a leer, decidir y alcanzar el botón.
  test('con acción dura más que un error sin ella', async () => {
    await render(<ToastHost />);
    await act(async () => {
      conAccion();
    });

    await avanzar(DURACION_MS.error + 500);
    expect(screen.getByRole('button', { name: 'Ajustes' })).toBeTruthy();

    await avanzar(DURACION_CON_ACCION_MS);
    expect(screen.queryByRole('button', { name: 'Ajustes' })).toBeNull();
  });

  // El lector de pantalla tiene que saber que hay algo que pulsar: el anuncio es
  // solo del texto, y sin esto el botón existe pero nadie sabe que hay que buscarlo.
  test('el anuncio dice que hay una acción disponible', async () => {
    await render(<ToastHost />);
    await act(async () => {
      conAccion();
    });

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Necesitamos permiso para acceder a tus fotos. Acción disponible: Ajustes.'
    );
  });
});
