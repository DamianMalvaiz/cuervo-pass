import { conPanelDeAcceso } from '../accesoWeb';

// El panel de marca de las pantallas de acceso solo existe en la web ancha, y solo en las tres pantallas para quien AÚN no entra. El cuestionario (ya con cuenta) y cualquier otra pantalla no lo llevan.

describe('conPanelDeAcceso', () => {
  it('web ancha + entrar, crear cuenta o recuperar: sí', () => {
    for (const s of ['login', 'registro', 'recuperar-contrasena']) expect(conPanelDeAcceso({ plataforma: 'web', ancho: 1280, segmentos: ['(auth)', s] })).toBe(true);
  });

  it('con menos de 1000 de ancho no (teléfono y tableta quedan como están)', () => {
    expect(conPanelDeAcceso({ plataforma: 'web', ancho: 999, segmentos: ['(auth)', 'login'] })).toBe(false);
    expect(conPanelDeAcceso({ plataforma: 'web', ancho: 390, segmentos: ['(auth)', 'login'] })).toBe(false);
  });

  it('en la app nativa nunca, aunque la pantalla sea ancha (una tableta)', () => {
    expect(conPanelDeAcceso({ plataforma: 'ios', ancho: 1366, segmentos: ['(auth)', 'login'] })).toBe(false);
    expect(conPanelDeAcceso({ plataforma: 'android', ancho: 1366, segmentos: ['(auth)', 'login'] })).toBe(false);
  });

  it('el cuestionario (ya con cuenta) y rutas desconocidas no llevan panel', () => {
    expect(conPanelDeAcceso({ plataforma: 'web', ancho: 1280, segmentos: ['(auth)', 'cuestionario-inicial'] })).toBe(false);
    expect(conPanelDeAcceso({ plataforma: 'web', ancho: 1280, segmentos: [] })).toBe(false);
  });
});
