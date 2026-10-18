import type { RolUsuario } from '@/types/database.types';

import { puedePublicar, tieneFuncionAprobada } from '../funciones';

// Cuervo 360 · quién puede publicar.
//
// «Publicar» ofrece algo (un depa, un cuarto, un negocio) y por eso exige una función de
// vendedor APROBADA. Pedirla no basta: nace `sin_verificar`. Esta regla decide qué se ve en la
// interfaz; la regla que de verdad lo impide llega a la base con la verificación de vendedor,
// y esta prueba no la sustituye.

const rol = (r: RolUsuario['rol'], estado: RolUsuario['estado'], origen: RolUsuario['origen'] = 'solicitud'): RolUsuario => ({
  usuario_id: 'u1', rol: r, estado, origen, desde: '2026-10-17T00:00:00Z',
});

test('una cuenta sin funciones extra no puede publicar', () => {
  expect(puedePublicar([])).toBe(false);
});

test.each(['sin_verificar', 'pendiente', 'rechazado'] as const)(
  'arrendador en %s NO puede publicar',
  (estado) => expect(puedePublicar([rol('arrendador', estado)])).toBe(false)
);

test.each(['arrendador', 'comerciante'] as const)('%s aprobado SÍ puede publicar', (r) => {
  expect(puedePublicar([rol(r, 'aprobado')])).toBe(true);
});

test('el arrendador migrado (aprobado por herencia) puede publicar: ya publicaba', () => {
  expect(puedePublicar([rol('arrendador', 'aprobado', 'migracion')])).toBe(true);
});

test('basta una función de vendedor aprobada aunque otra no lo esté', () => {
  expect(puedePublicar([rol('comerciante', 'sin_verificar'), rol('arrendador', 'aprobado')])).toBe(true);
});

// El administrador revisa, no vende: ser admin no da derecho a publicar.
test('admin por sí solo no puede publicar', () => {
  expect(puedePublicar([rol('admin', 'aprobado')])).toBe(false);
});

describe('tieneFuncionAprobada', () => {
  const rol = (r: string, estado: string) => ({ usuario_id: 'u', rol: r, estado, origen: 'solicitud', desde: 'x' }) as never;
  it('solo cuenta la función pedida y aprobada', () => {
    const roles = [rol('comerciante', 'aprobado'), rol('arrendador', 'pendiente')];
    expect(tieneFuncionAprobada(roles, 'comerciante')).toBe(true);
    expect(tieneFuncionAprobada(roles, 'arrendador')).toBe(false);
  });
  it('sin roles no tiene ninguna', () => {
    expect(tieneFuncionAprobada([], 'comerciante')).toBe(false);
  });
});
