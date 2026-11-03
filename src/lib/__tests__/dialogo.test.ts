import { Alert, Platform } from 'react-native';

import { dialogo } from '../dialogo';

// `dialogo` es `Alert.alert` que también funciona en la web. react-native-web no trae diálogos (`Alert.alert` ahí no hace nada), y un aviso o una confirmación que no aparece deja la pantalla muerta:
// «Entendido» era el botón que navegaba. En la app es EXACTAMENTE `Alert.alert`; en el navegador, `window.alert` (un botón) o `window.confirm` (aceptar / cancelar).

const g = globalThis as unknown as { window?: unknown };
const nav = { alert: jest.fn(), confirm: jest.fn() };

beforeEach(() => {
  nav.alert.mockReset();
  nav.confirm.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  delete g.window;
  jest.restoreAllMocks();
});
const enWeb = () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  g.window = nav;
};

describe('en la app', () => {
  it('es Alert.alert, tal cual', () => {
    const botones = [{ text: 'Cancelar', style: 'cancel' as const }, { text: 'Borrar', style: 'destructive' as const, onPress: jest.fn() }];
    dialogo('Título', 'Mensaje', botones);
    expect(Alert.alert).toHaveBeenCalledWith('Título', 'Mensaje', botones);
  });
});

describe('en la web: un solo botón (un aviso)', () => {
  it('muestra el aviso y, al aceptarlo, hace lo que el botón hacía', () => {
    enWeb();
    const alEntender = jest.fn();
    dialogo('Aviso', 'Algo pasó', [{ text: 'Entendido', onPress: alEntender }]);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(nav.alert).toHaveBeenCalledWith('Aviso\n\nAlgo pasó');
    expect(alEntender).toHaveBeenCalledTimes(1);
  });
  it('sin botones también avisa, y no falla', () => {
    enWeb();
    expect(() => dialogo('Aviso', 'Algo pasó')).not.toThrow();
    expect(nav.alert).toHaveBeenCalledTimes(1);
  });
});

describe('en la web: cancelar y una acción (una confirmación)', () => {
  const montar = () => {
    const cancelar = jest.fn();
    const borrar = jest.fn();
    return { cancelar, borrar, botones: [{ text: 'Cancelar', style: 'cancel' as const, onPress: cancelar }, { text: 'Borrar', style: 'destructive' as const, onPress: borrar }] };
  };
  it('al aceptar hace la acción, y NO la de cancelar', () => {
    enWeb();
    nav.confirm.mockReturnValue(true);
    const m = montar();
    dialogo('Borrar', 'No se puede deshacer', m.botones);
    expect(nav.confirm).toHaveBeenCalledWith('Borrar\n\nNo se puede deshacer');
    expect(m.borrar).toHaveBeenCalledTimes(1);
    expect(m.cancelar).not.toHaveBeenCalled();
  });
  it('al cancelar no hace la acción (y corre la de cancelar, si la hay)', () => {
    enWeb();
    nav.confirm.mockReturnValue(false);
    const m = montar();
    dialogo('Borrar', 'No se puede deshacer', m.botones);
    expect(m.borrar).not.toHaveBeenCalled();
    expect(m.cancelar).toHaveBeenCalledTimes(1);
  });
  it('el orden de los botones da igual: la acción es la que no es «cancel»', () => {
    enWeb();
    nav.confirm.mockReturnValue(true);
    const m = montar();
    dialogo('Borrar', 'x', [...m.botones].reverse());
    expect(m.borrar).toHaveBeenCalledTimes(1);
  });
});

describe('en la web: tres botones o más (un menú de motivos)', () => {
  const montar = () => {
    const cancelar = jest.fn();
    const a = jest.fn();
    const b = jest.fn();
    return { cancelar, a, b, botones: [{ text: 'Cancelar', style: 'cancel' as const, onPress: cancelar }, { text: 'Motivo A', onPress: a }, { text: 'Motivo B', onPress: b }] };
  };
  it('pregunta una por una y ejecuta SOLO la primera que se acepta', () => {
    enWeb();
    nav.confirm.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const m = montar();
    dialogo('¿Por qué?', 'Elige', m.botones);
    expect(nav.confirm).toHaveBeenCalledTimes(2);
    expect(nav.confirm.mock.calls[0][0]).toMatch(/¿Elegir: «Motivo A»\?/);
    expect(nav.confirm.mock.calls[1][0]).toMatch(/¿Elegir: «Motivo B»\?/);
    expect(m.a).not.toHaveBeenCalled();
    expect(m.b).toHaveBeenCalledTimes(1);
    expect(m.cancelar).not.toHaveBeenCalled();
  });
  it('si aceptas la primera, ya no pregunta por las demás', () => {
    enWeb();
    nav.confirm.mockReturnValue(true);
    const m = montar();
    dialogo('¿Por qué?', 'Elige', m.botones);
    expect(nav.confirm).toHaveBeenCalledTimes(1);
    expect(m.a).toHaveBeenCalledTimes(1);
  });
  it('si las rechazas todas no se elige por nadie: no pasa nada (solo corre «cancelar», si lo hay)', () => {
    enWeb();
    nav.confirm.mockReturnValue(false);
    const m = montar();
    dialogo('¿Por qué?', 'Elige', m.botones);
    expect(m.a).not.toHaveBeenCalled();
    expect(m.b).not.toHaveBeenCalled();
    expect(m.cancelar).toHaveBeenCalledTimes(1);
  });
});
