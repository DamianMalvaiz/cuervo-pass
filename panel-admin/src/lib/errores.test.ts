import { describe, expect, test } from 'vitest';

import { ErrorAdmin, MENSAJE_ERROR_ADMIN, tipoDeErrorAdmin } from './errores';

// Misma tabla que la app móvil: un fallo NUNCA se confunde con «no hay nada». Sin código HTTP no llegó respuesta: es la red.
describe('tipoDeErrorAdmin', () => {
  test.each([
    [undefined, undefined, 'red'],
    [401, undefined, 'prohibido'],
    [403, 'prohibido', 'prohibido'],
    [409, 'no_pendiente', 'no_pendiente'],
    [409, 'otro', 'desconocido'],
    [400, 'motivo_requerido', 'motivo_requerido'],
    [400, 'datos_invalidos', 'desconocido'],
    [404, 'no_existe', 'no_existe'],
    [503, 'sin_configurar', 'no_disponible'],
    [500, 'error_interno', 'desconocido'],
  ] as const)('%s + %s → %s', (status, codigo, esperado) => {
    expect(tipoDeErrorAdmin(status, codigo)).toBe(esperado);
  });

  test('todo tipo tiene un mensaje en español', () => {
    for (const tipo of ['prohibido', 'no_pendiente', 'motivo_requerido', 'no_existe', 'no_disponible', 'red', 'desconocido'] as const) {
      expect(MENSAJE_ERROR_ADMIN[tipo].length).toBeGreaterThan(5);
    }
    expect(new ErrorAdmin('red').tipo).toBe('red');
  });
});
