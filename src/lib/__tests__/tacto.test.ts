// END-37 · Lo que de verdad hay que comprobar del tacto no es que vibre —eso
// solo se juzga con el telefono en la mano— sino que NO TUMBE LA APP cuando no
// puede vibrar.
//
// `expo-haptics` es un modulo NATIVO. En un cliente de desarrollo compilado
// antes de instalarlo, la llamada lanza «Cannot find native module
// 'ExpoHaptics'». Sin envoltura, eso revienta el `catch` de BotonVerContacto y
// la persona ve «No pudimos obtener el contacto» DESPUES de que el contacto se
// revelo y le cobraron la cuota.

const mockNotificacion = jest.fn();
const mockImpacto = jest.fn();

jest.mock('expo-haptics', () => ({
  notificationAsync: (...a: unknown[]) => mockNotificacion(...a),
  impactAsync: (...a: unknown[]) => mockImpacto(...a),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

import { sello, toque } from '../tacto';

beforeEach(() => {
  mockNotificacion.mockReset().mockResolvedValue(undefined);
  mockImpacto.mockReset().mockResolvedValue(undefined);
});

test('sello pide la vibracion de confirmacion', () => {
  sello();
  expect(mockNotificacion).toHaveBeenCalledWith('success');
});

test('toque pide el impacto ligero', () => {
  toque();
  expect(mockImpacto).toHaveBeenCalledWith('light');
});

// LA prueba. Un modulo nativo ausente lanza al llamar, no al importar.
test('sin modulo nativo no lanza: la app no se cae por no poder vibrar', async () => {
  mockNotificacion.mockRejectedValue(new Error("Cannot find native module 'ExpoHaptics'"));
  expect(() => sello()).not.toThrow();
  // Y tampoco deja una promesa rechazada sin capturar, que en React Native
  // aparece como un aviso amarillo sobre la pantalla en cada toque.
  await new Promise((listo) => setTimeout(listo, 0));
});

// El caso sincrono: algunas versiones lanzan ANTES de devolver la promesa.
test('si lanza de forma sincrona tampoco se propaga', () => {
  mockImpacto.mockImplementation(() => {
    throw new Error('sin motor de vibracion');
  });
  expect(() => toque()).not.toThrow();
});
