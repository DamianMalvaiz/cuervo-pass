import { readFileSync } from 'node:fs';

import {
  construirPreferencia,
  interpretarRespuestaPreferencia,
  respuestaDeErrorOrden,
  validarSolicitudPago,
} from '../../supabase/functions/crear-pago/politica';

// Lógica pura de `crear-pago` (paso 4): sin Deno, sin red, sin Supabase. La Edge Function solo la aplica.
//
// Lo que se protege aquí es lo que, si falla, cobra mal o manda a la persona a donde no debe:
//   · el monto y el nombre del plan los pone el SERVIDOR (la orden), nunca el cliente: la solicitud solo dice QUÉ plan;
//   · la URL a la que se manda a pagar viene de la respuesta de Mercado Pago y se comprueba (https y dominio de Mercado Pago);
//   · un fallo de Mercado Pago se dice como fallo del servicio, no como «plan no disponible».

const UUID_ORDEN = 'a3b1c2d4-0000-4000-8000-123456789abc';
const orden = { ordenId: UUID_ORDEN, planId: 'comerciante_basico', planNombre: 'Básico', montoCentavos: 9900 };

describe('validarSolicitudPago', () => {
  test('un plan con la forma de los de la tabla', () => {
    expect(validarSolicitudPago({ plan_id: 'comerciante_basico' })).toEqual({ ok: true, planId: 'comerciante_basico' });
  });

  test.each([null, undefined, 5, 'texto', true, []])('un cuerpo que no es un objeto (%p) es «cuerpo inválido», no una excepción', (c) => {
    expect(validarSolicitudPago(c)).toEqual({ ok: false, error: 'cuerpo inválido' });
  });

  test.each([undefined, null, 5, '', 'AB', 'Comerciante_Basico', 'con espacio', '../x', 'a'.repeat(41), "x'; drop table planes; --"])(
    'un plan que no tiene la forma de un id (%p) es «plan inválido»',
    (plan_id) => {
      expect(validarSolicitudPago({ plan_id })).toEqual({ ok: false, error: 'plan inválido' });
    },
  );

  test('lo demás que mande el cliente se ignora: el monto NO se lee de aquí', () => {
    expect(validarSolicitudPago({ plan_id: 'comerciante_basico', monto: 1, unit_price: 1, usuario_id: 'otro' })).toEqual({
      ok: true,
      planId: 'comerciante_basico',
    });
  });
});

describe('construirPreferencia', () => {
  test('un artículo, en pesos, con la orden como referencia', () => {
    expect(construirPreferencia(orden)).toEqual({
      items: [{ id: 'comerciante_basico', title: 'Cuervo 360 · Plan Básico (30 días)', quantity: 1, unit_price: 99, currency_id: 'MXN' }],
      external_reference: UUID_ORDEN,
    });
  });

  test('el monto sale de los centavos de la orden', () => {
    expect(construirPreferencia({ ...orden, montoCentavos: 19900 }).items[0].unit_price).toBe(199);
    expect(construirPreferencia({ ...orden, montoCentavos: 9950 }).items[0].unit_price).toBe(99.5);
    expect(construirPreferencia({ ...orden, montoCentavos: 29 }).items[0].unit_price).toBe(0.29);
  });

  test('no manda datos de la persona: ni correo ni nombre ni id de usuario', () => {
    const texto = JSON.stringify(construirPreferencia(orden));
    expect(texto).not.toMatch(/payer|email|usuario|nombre_usuario/i);
  });

  test('no pide avisos por su cuenta: la URL de notificación es la del panel (firmada con su secreto)', () => {
    expect(JSON.stringify(construirPreferencia(orden))).not.toContain('notification_url');
  });

  test.each([0, -100, 9.5, NaN, Infinity])('un monto que no son centavos enteros y positivos (%p) lanza: es un error de programación, no de la persona', (m) => {
    expect(() => construirPreferencia({ ...orden, montoCentavos: m })).toThrow();
  });
});

describe('interpretarRespuestaPreferencia', () => {
  const buena = { id: '123456789-abc', init_point: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=123456789-abc' };

  test('una preferencia creada: su id y la URL de pago', () => {
    expect(interpretarRespuestaPreferencia(201, buena)).toEqual({ ok: true, preferenceId: '123456789-abc', url: buena.init_point });
    expect(interpretarRespuestaPreferencia(200, buena).ok).toBe(true);
  });

  test.each(['https://www.mercadopago.com.mx/x', 'https://mercadopago.com.mx/x', 'https://checkout.mercadopago.com/x', 'https://www.mercadopago.com/x'])(
    'dominios de Mercado Pago permitidos (%s)',
    (url) => {
      expect(interpretarRespuestaPreferencia(201, { ...buena, init_point: url }).ok).toBe(true);
    },
  );

  test.each([
    'http://www.mercadopago.com.mx/x',
    'https://mercadopago.com.mx.atacante.com/x',
    'https://atacante.com/?https://www.mercadopago.com.mx/',
    'https://notmercadopago.com.mx/x',
    'javascript:alert(1)',
    'cuervopass://pago',
    'no es una url',
  ])('una URL que no es de Mercado Pago o no es https (%s) NO se devuelve', (url) => {
    expect(interpretarRespuestaPreferencia(201, { ...buena, init_point: url })).toEqual({ ok: false, motivo: 'url-no-permitida' });
  });

  test.each([null, undefined, 'texto', 5, [], {}, { id: '', init_point: buena.init_point }, { id: 5, init_point: buena.init_point }, { id: 'x' }, { id: 'x', init_point: 5 }])(
    'una respuesta 2xx sin la forma esperada (%p) es inesperada',
    (cuerpo) => {
      expect(interpretarRespuestaPreferencia(201, cuerpo)).toEqual({ ok: false, motivo: 'respuesta-inesperada' });
    },
  );

  test.each([400, 401, 403, 404, 422])('un %i de Mercado Pago es un rechazo (token, datos): no se reintenta igual', (estado) => {
    expect(interpretarRespuestaPreferencia(estado, { message: 'x' })).toEqual({ ok: false, motivo: 'mp-rechazo' });
  });

  test.each([429, 500, 502, 503, 504])('un %i de Mercado Pago es que no está disponible', (estado) => {
    expect(interpretarRespuestaPreferencia(estado, null)).toEqual({ ok: false, motivo: 'mp-no-disponible' });
  });
});

describe('respuestaDeErrorOrden', () => {
  test('CP011: el plan no aplica a esta cuenta', () => {
    expect(respuestaDeErrorOrden('CP011')).toEqual({ status: 409, error: 'plan_no_disponible' });
  });
  test('CP015: demasiadas órdenes sin pagar', () => {
    expect(respuestaDeErrorOrden('CP015')).toEqual({ status: 429, error: 'demasiadas_ordenes' });
  });
  test.each([undefined, '', 'XX000', '42501', '23505'])('cualquier otro error (%p) es interno y no se explica', (code) => {
    expect(respuestaDeErrorOrden(code)).toEqual({ status: 500, error: 'error_interno' });
  });
});

describe('index.ts aplica la política', () => {
  const fuente = readFileSync('supabase/functions/crear-pago/index.ts', 'utf8');

  test('usa la política para validar, construir e interpretar', () => {
    for (const nombre of ['validarSolicitudPago(', 'construirPreferencia(', 'interpretarRespuestaPreferencia(', 'respuestaDeErrorOrden(']) {
      expect(fuente).toContain(nombre);
    }
  });

  test('comprueba los secrets ANTES de crear la orden', () => {
    const iSecrets = fuente.indexOf('MP_ACCESS_TOKEN');
    const iOrden = fuente.indexOf("rpc('crear_orden_pago'");
    expect(iSecrets).toBeGreaterThan(-1);
    expect(iOrden).toBeGreaterThan(-1);
    expect(iSecrets).toBeLessThan(iOrden);
  });

  test('la identidad sale de la sesión, nunca del cuerpo', () => {
    expect(fuente).toMatch(/p_usuario:\s*user\.id/);
    expect(fuente).not.toMatch(/p_usuario:\s*(crudo|cuerpo|solicitud)/);
  });

  test('el token de Mercado Pago solo va en la cabecera: nunca a un console', () => {
    expect(fuente).not.toMatch(/console\.\w+\([^)]*(MP_ACCESS_TOKEN|token)/i);
  });

  test('manda la clave de idempotencia (reintentar no crea dos preferencias)', () => {
    expect(fuente).toContain('X-Idempotency-Key');
  });
});
