import { describirSuscripcion, diasRestantes, fechaLarga, incluyeDe, precioDe, type MiSuscripcion } from '../planes';

const ahora = new Date('2026-10-17T12:00:00Z');
const sus = (extra: Partial<MiSuscripcion> = {}): MiSuscripcion => ({
  plan_id: 'comerciante_basico', plan_nombre: 'Básico', estado: 'prueba', hasta: '2026-11-01T12:00:00Z',
  limite_principal: 1, max_fotos: 20, max_productos: 80, destaca: false, ...extra,
});

describe('precioDe', () => {
  it.each([[9900, '$99'], [19900, '$199'], [12550, '$125.5'], [0, 'Gratis']])('%s → %s', (c, t) => {
    expect(precioDe(c)).toBe(t);
  });
});

describe('diasRestantes', () => {
  it('cuenta días enteros hacia arriba: «vence hoy» es 1', () => {
    expect(diasRestantes('2026-10-17T18:00:00Z', ahora)).toBe(1);
    expect(diasRestantes('2026-10-18T12:00:00Z', ahora)).toBe(1);
    expect(diasRestantes('2026-10-18T12:00:01Z', ahora)).toBe(2);
  });
  it('quince días exactos son 15', () => expect(diasRestantes('2026-11-01T12:00:00Z', ahora)).toBe(15));
  it('si ya pasó, o no hay fecha, son 0', () => {
    expect(diasRestantes('2026-10-16T12:00:00Z', ahora)).toBe(0);
    expect(diasRestantes(null, ahora)).toBe(0);
  });
});

describe('fechaLarga', () => {
  it('la escribe en español', () => expect(fechaLarga('2026-11-12T18:00:00Z')).toMatch(/12 de noviembre de 2026/));
});

describe('describirSuscripcion', () => {
  it('en prueba dice cuántos días quedan', () => {
    expect(describirSuscripcion(sus(), ahora)).toBe('Prueba gratis · te quedan 15 días');
  });
  it('con un solo día lo dice en singular', () => {
    expect(describirSuscripcion(sus({ hasta: '2026-10-18T10:00:00Z' }), ahora)).toBe('Prueba gratis · te queda 1 día');
  });
  it('con plan vigente dice el plan y hasta cuándo', () => {
    const t = describirSuscripcion(sus({ estado: 'vigente', plan_nombre: 'Destacado', hasta: '2026-11-12T18:00:00Z' }), ahora);
    expect(t).toMatch(/^Plan Destacado · vigente hasta el 12 de noviembre de 2026$/);
  });
  it('sin plan lo dice con claridad: el negocio no aparece', () => {
    expect(describirSuscripcion(sus({ estado: 'gratis', hasta: null }), ahora)).toMatch(/no aparece en Servicios/);
  });
  it('si la base dice «prueba» o «vigente» pero sin fecha, no inventa: cae a «sin plan»', () => {
    expect(describirSuscripcion(sus({ estado: 'vigente', hasta: null }), ahora)).toMatch(/Sin plan/);
  });
});

describe('incluyeDe', () => {
  it('un comerciante: negocios, fotos y productos; y destacar si el plan lo da', () => {
    expect(incluyeDe({ limite_principal: 3, max_fotos: 60, max_productos: 250, destaca: true }, 'comerciante')).toEqual([
      '3 negocios visibles', 'Hasta 60 fotos de galería', 'Hasta 250 productos en el menú', 'Aparece primero en las listas',
    ]);
  });
  it('singular con 1', () => {
    expect(incluyeDe({ limite_principal: 1, max_fotos: 20, max_productos: 80, destaca: false }, 'comerciante')[0]).toBe('1 negocio visible');
  });
  it('un arrendador: anuncios, sin fotos ni productos de menú', () => {
    expect(incluyeDe({ limite_principal: 15, max_fotos: 8, max_productos: 0, destaca: true }, 'arrendador')).toEqual([
      '15 anuncios visibles', 'Aparece primero en las listas',
    ]);
  });
});
