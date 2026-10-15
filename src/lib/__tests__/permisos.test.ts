// El aviso de permiso de fotos denegado, con su acción «Ajustes».
//
// «Ajustes» solo sirve cuando el sistema YA NO VOLVERÁ A PREGUNTAR
// (`canAskAgain === false`): en iOS tras la primera negativa, y en Android tras la
// segunda («no volver a preguntar»). Mientras todavía pueda preguntar, basta con
// volver a tocar y aparece el diálogo del sistema; mandar a Ajustes sería un rodeo.
//
// Y cuando el estado no se sabe (`undefined`) se ofrece: es mejor un botón de más
// que una persona atrapada sin camino para darse el permiso.

import { Linking } from 'react-native';

const mockAviso = jest.fn();
jest.mock('@/lib/registro', () => ({ aviso: (...a: unknown[]) => mockAviso(...a) }));

import { MENSAJE_PERMISO_FOTOS, abrirAjustes, avisarPermisoDeFotosDenegado } from '@/lib/permisos';
import { useToastStore } from '@/store/useToastStore';

const aviso = () => useToastStore.getState().actual;

beforeEach(() => {
  jest.clearAllMocks();
  useToastStore.setState({ actual: null });
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

test('devuelve el mensaje, para que el formulario lo deje también en pantalla', () => {
  expect(avisarPermisoDeFotosDenegado(false)).toBe(MENSAJE_PERMISO_FOTOS);
  expect(MENSAJE_PERMISO_FOTOS).toBe('Necesitamos permiso para acceder a tus fotos');
});

test('si el sistema ya no volverá a preguntar, ofrece «Ajustes»', () => {
  avisarPermisoDeFotosDenegado(false);
  expect(aviso()).toMatchObject({ tipo: 'error', mensaje: MENSAJE_PERMISO_FOTOS });
  expect(aviso()?.accion?.etiqueta).toBe('Ajustes');
});

test('si todavía puede preguntar, NO ofrece «Ajustes»: basta con volver a tocar', () => {
  avisarPermisoDeFotosDenegado(true);
  expect(aviso()).toMatchObject({ tipo: 'error', mensaje: MENSAJE_PERMISO_FOTOS });
  expect(aviso()?.accion).toBeUndefined();
});

test('si no se sabe, ofrece «Ajustes»', () => {
  avisarPermisoDeFotosDenegado(undefined);
  expect(aviso()?.accion?.etiqueta).toBe('Ajustes');
});

test('pulsar «Ajustes» abre los ajustes de la app', async () => {
  avisarPermisoDeFotosDenegado(false);
  aviso()?.accion?.onPress();
  await Promise.resolve();
  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
});

describe('abrirAjustes', () => {
  test('abre los ajustes', async () => {
    await abrirAjustes();
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  // Abrir los Ajustes no es de fiar en todos los teléfonos. Si falla, la persona
  // no se queda sin saber qué hacer: se le dice dónde ir a mano.
  test('si no se pueden abrir, no propaga y dice dónde ir', async () => {
    jest.spyOn(Linking, 'openSettings').mockRejectedValue(new Error('sin soporte'));

    await expect(abrirAjustes()).resolves.toBeUndefined();

    expect(mockAviso).toHaveBeenCalledTimes(1);
    expect(aviso()).toMatchObject({ tipo: 'info' });
    expect(aviso()?.mensaje).toMatch(/Ajustes/);
  });
});
