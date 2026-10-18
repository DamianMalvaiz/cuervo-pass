import { ErrorAdmin, MENSAJE_ERROR_ADMIN, esAdmin, tipoDeErrorAdmin } from '../admin';

const rol = (r: string, estado: string) => ({ usuario_id: 'u', rol: r, estado, origen: 'sembrado', desde: '2026-10-17' }) as never;

describe('esAdmin', () => {
  it('solo con el rol admin APROBADO', () => {
    expect(esAdmin([rol('admin', 'aprobado')])).toBe(true);
  });
  it.each(['sin_verificar', 'pendiente', 'rechazado'])('admin «%s» no es admin', (estado) => {
    expect(esAdmin([rol('admin', estado)])).toBe(false);
  });
  it('un comerciante aprobado no es admin', () => {
    expect(esAdmin([rol('comerciante', 'aprobado'), rol('arrendador', 'aprobado')])).toBe(false);
  });
  it('sin roles, no', () => {
    expect(esAdmin([])).toBe(false);
  });
});

describe('tipoDeErrorAdmin', () => {
  it.each([
    [403, undefined, 'prohibido'],
    [401, undefined, 'prohibido'],
    [409, 'no_pendiente', 'no_pendiente'],
    [400, 'motivo_requerido', 'motivo_requerido'],
    [404, 'no_existe', 'no_existe'],
    [503, 'sin_configurar', 'no_disponible'],
    [500, 'error_interno', 'desconocido'],
    [400, 'datos_invalidos', 'desconocido'],
  ])('%s %s → %s', (status, codigo, esperado) => {
    expect(tipoDeErrorAdmin(status, codigo)).toBe(esperado);
  });

  it('sin respuesta HTTP es un fallo de red, no un rechazo', () => {
    expect(tipoDeErrorAdmin(undefined, undefined)).toBe('red');
  });
});

describe('ErrorAdmin', () => {
  it('conserva su tipo y todo tipo tiene un mensaje en lenguaje de persona', () => {
    const e = new ErrorAdmin('red');
    expect(e.tipo).toBe('red');
    for (const m of Object.values(MENSAJE_ERROR_ADMIN)) expect(m.length).toBeGreaterThan(10);
    expect(MENSAJE_ERROR_ADMIN.red).toMatch(/conexi/i);
  });
});
