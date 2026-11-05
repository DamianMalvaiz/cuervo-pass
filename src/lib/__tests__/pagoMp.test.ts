import {
  ErrorPago,
  describirOrden,
  esUrlDePago,
  mensajeDeErrorPago,
  sondearOrden,
  textoConfirmarPago,
  tipoDeErrorPago,
  type TipoErrorPago,
} from '../pagoMp';

// Pagos con Mercado Pago · lo que la app dice y decide (paso 4). Lo que se fija: cada fallo se explica por SU motivo (un fallo de Mercado Pago no se
// dice «plan no disponible»), nunca se abre una URL que no sea de Mercado Pago, y lo pendiente se dice como pendiente.

describe('tipoDeErrorPago', () => {
  test.each<[number | undefined, string | undefined, TipoErrorPago]>([
    [undefined, undefined, 'red'],
    [401, undefined, 'sesion'],
    [409, 'plan_no_disponible', 'plan_no_disponible'],
    [429, 'demasiadas_ordenes', 'demasiadas_ordenes'],
    [502, undefined, 'no_disponible'],
    [503, undefined, 'no_disponible'],
    [500, 'error_interno', 'desconocido'],
    [400, 'plan inválido', 'desconocido'],
    [409, 'otra cosa', 'desconocido'],
    [429, 'otra cosa', 'desconocido'],
  ])('estado %p, código %p → %s', (status, codigo, esperado) => {
    expect(tipoDeErrorPago(status, codigo)).toBe(esperado);
  });
});

describe('ErrorPago', () => {
  test('lleva su tipo y es un Error', () => {
    const e = new ErrorPago('no_disponible');
    expect(e).toBeInstanceOf(Error);
    expect(e.tipo).toBe('no_disponible');
  });
});

describe('mensajeDeErrorPago', () => {
  const tipos: TipoErrorPago[] = ['plan_no_disponible', 'demasiadas_ordenes', 'no_disponible', 'sesion', 'red', 'desconocido'];

  test('cada tipo tiene su propio mensaje, y ninguno se repite', () => {
    const textos = tipos.map(mensajeDeErrorPago);
    expect(new Set(textos).size).toBe(tipos.length);
  });
  test('un fallo de Mercado Pago NO se dice «plan no disponible» ni «verifica tu identidad»', () => {
    expect(mensajeDeErrorPago('no_disponible')).toMatch(/Mercado Pago/);
    expect(mensajeDeErrorPago('no_disponible')).not.toMatch(/identidad|no está disponible para tu cuenta/);
  });
  test('un plan no disponible manda a verificar la identidad', () => {
    expect(mensajeDeErrorPago('plan_no_disponible')).toMatch(/Verifica tu identidad/);
  });
  test('la red se dice como red', () => {
    expect(mensajeDeErrorPago('red')).toMatch(/conexión/);
  });
});

describe('esUrlDePago · solo se abre una URL de Mercado Pago', () => {
  test.each(['https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=1', 'https://mercadopago.com.mx/x', 'https://checkout.mercadopago.com/x'])('permitida: %s', (u) => {
    expect(esUrlDePago(u)).toBe(true);
  });
  test.each([
    'http://www.mercadopago.com.mx/x',
    'https://mercadopago.com.mx.atacante.com/x',
    'https://mercadopago.com.mx@atacante.com/x',
    'https://notmercadopago.com.mx/x',
    'javascript:alert(1)',
    'cuervopass://pago',
    'no es una url',
    '',
    null,
    undefined,
    5,
  ])('NO permitida: %p', (u) => {
    expect(esUrlDePago(u)).toBe(false);
  });
});

describe('textoConfirmarPago', () => {
  const t = textoConfirmarPago('$199');
  // Pedido explícito: el cliente no lee «modo de prueba» ni «no se cobra dinero real» al pagar. Dice cuánto y qué pasa con OXXO.
  test('dice cuánto y qué pasa con OXXO, sin hablar de «modo de prueba»', () => {
    expect(t).toContain('$199');
    expect(t).toMatch(/OXXO/);
    expect(t).not.toMatch(/prueba|no se cobra dinero real/i);
  });
});

describe('describirOrden', () => {
  const ahora = new Date('2026-11-01T12:00:00Z');
  const hace = (min: number) => new Date(ahora.getTime() - min * 60_000).toISOString();

  test('pendiente: es el caso de OXXO, se activa al pagar en la tienda', () => {
    expect(describirOrden('pendiente', hace(500), ahora)).toMatch(/pendiente.*OXXO/s);
  });
  test('creada hace poco: se espera la confirmación', () => {
    expect(describirOrden('creada', hace(5), ahora)).toMatch(/esperando la confirmación/i);
  });
  test('creada hace mucho es solo una orden que se abandonó: no se dice nada', () => {
    expect(describirOrden('creada', hace(31), ahora)).toBeNull();
  });
  test.each(['pagada', 'rechazada', 'otra', undefined, null])('«%s» no lleva aviso', (estado) => {
    expect(describirOrden(estado as string | null | undefined, hace(1), ahora)).toBeNull();
  });
  test('una fecha imposible de leer no inventa un aviso', () => {
    expect(describirOrden('creada', 'no es una fecha', ahora)).toBeNull();
  });
});

describe('sondearOrden', () => {
  test('solo mientras la orden espera su aviso (creada): cada 5 s', () => {
    expect(sondearOrden('creada')).toBe(5000);
  });
  test.each(['pendiente', 'pagada', 'rechazada', undefined])('con «%s» no se sondea', (estado) => {
    expect(sondearOrden(estado)).toBe(false);
  });
});
