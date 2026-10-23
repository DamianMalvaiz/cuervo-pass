import { createHmac } from 'node:crypto';

import { igualEnTiempoConstante } from '../../supabase/functions/_shared/tiempoConstante';
import {
  clasificarConsultaPago,
  construirManifiesto,
  decidirPago,
  extraerAviso,
  hmacSha256Hex,
  parsearFirma,
  respuestaDeDecisionFallida,
  respuestaDeFirmaFallida,
  respuestaDeRegistro,
  verificarFirma,
} from '../../supabase/functions/mp-webhook/politica';

// Lógica pura del webhook de Mercado Pago (paso 2): sin Deno, sin red, sin Supabase. La Edge Function `mp-webhook` (paso 3) solo la aplica.
//
// Lo que se protege aquí es lo que, si falla en silencio, regala planes o pierde pagos:
//   · una firma que NO se verifica, o que se verifica contra un secreto vacío (el aviso lo puede mandar cualquiera: es una URL pública);
//   · confiar en lo que diga el aviso en vez de en lo que cobró Mercado Pago (monto, moneda, orden);
//   · contestar un 500 a un aviso que nunca se va a poder procesar (reintentos eternos) o un 200 a uno que sí se puede reintentar (pago perdido).
//
// La plantilla de la firma sale de la documentación de Mercado Pago (`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, HMAC-SHA256 en hex, y si falta
// un valor se omite ese segmento). Estas pruebas fijan el CÓDIGO contra esa plantilla; que la plantilla sea la que Mercado Pago usa de verdad solo
// lo demuestra «Simular notificación» en su panel.

const SECRETO = 'secreto-de-prueba-del-webhook';
const DATA_ID = '123456789';
const REQUEST_ID = '2066ca19-c6f1-498a-be75-1923005edd06';
const TS = '1704908010';
const UUID_ORDEN = 'a3b1c2d4-0000-4000-8000-123456789abc';

/** La firma como la calcularía Mercado Pago, con la implementación de Node (independiente de la que se prueba). */
function firmar(manifiesto: string, secreto = SECRETO): string {
  return createHmac('sha256', secreto).update(manifiesto).digest('hex');
}
const cabecera = (manifiesto: string, ts = TS, secreto = SECRETO) => `ts=${ts},v1=${firmar(manifiesto, secreto)}`;
const MANIFIESTO = `id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`;

describe('hmacSha256Hex', () => {
  test('vector público RFC 4231 (caso 2): la implementación es HMAC-SHA256 de verdad', async () => {
    expect(await hmacSha256Hex('Jefe', 'what do ya want for nothing?')).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  test('coincide con la de Node para el manifiesto de este archivo', async () => {
    expect(await hmacSha256Hex(SECRETO, MANIFIESTO)).toBe(firmar(MANIFIESTO));
  });
});

describe('igualEnTiempoConstante', () => {
  test('iguales', () => {
    expect(igualEnTiempoConstante('abc', 'abc')).toBe(true);
    expect(igualEnTiempoConstante('', '')).toBe(true);
    expect(igualEnTiempoConstante('árbol', 'árbol')).toBe(true);
  });
  test('distintas, de otra longitud o con un solo carácter de diferencia', () => {
    expect(igualEnTiempoConstante('abc', 'abd')).toBe(false);
    expect(igualEnTiempoConstante('abc', 'abcd')).toBe(false);
    expect(igualEnTiempoConstante('abcd', 'abc')).toBe(false);
    expect(igualEnTiempoConstante('', 'a')).toBe(false);
  });
});

describe('parsearFirma', () => {
  const v1 = '618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839';

  test('el ejemplo de la documentación', () => {
    expect(parsearFirma(`ts=1704908010,v1=${v1}`)).toEqual({ ts: '1704908010', v1 });
  });
  test('tolera espacios y cualquier orden', () => {
    expect(parsearFirma(`v1=${v1}, ts=1704908010`)).toEqual({ ts: '1704908010', v1 });
  });
  test('ignora claves que no conoce', () => {
    expect(parsearFirma(`ts=1704908010,v0=otra,v1=${v1}`)).toEqual({ ts: '1704908010', v1 });
  });
  test('normaliza el hex a minúsculas', () => {
    expect(parsearFirma(`ts=1704908010,v1=${v1.toUpperCase()}`)?.v1).toBe(v1);
  });
  test.each([null, undefined, '', 'basura', 'ts=1704908010', `v1=${v1}`, `ts=abc,v1=${v1}`, 'ts=1704908010,v1=corto', `ts=1704908010,v1=${'z'.repeat(64)}`])(
    'una cabecera inválida (%p) no se interpreta',
    (c) => {
      expect(parsearFirma(c as string | null | undefined)).toBeNull();
    },
  );
});

describe('construirManifiesto', () => {
  test('con los tres valores', () => {
    expect(construirManifiesto({ dataId: DATA_ID, requestId: REQUEST_ID, ts: TS })).toBe(MANIFIESTO);
  });
  test('el id va en minúsculas (la documentación lo exige cuando es alfanumérico)', () => {
    expect(construirManifiesto({ dataId: 'ABC123', requestId: REQUEST_ID, ts: TS })).toBe(`id:abc123;request-id:${REQUEST_ID};ts:${TS};`);
  });
  test('si falta un valor se omite ese segmento', () => {
    expect(construirManifiesto({ dataId: DATA_ID, requestId: null, ts: TS })).toBe(`id:${DATA_ID};ts:${TS};`);
    expect(construirManifiesto({ dataId: null, requestId: REQUEST_ID, ts: TS })).toBe(`request-id:${REQUEST_ID};ts:${TS};`);
    expect(construirManifiesto({ dataId: DATA_ID, requestId: '', ts: TS })).toBe(`id:${DATA_ID};ts:${TS};`);
  });
});

describe('verificarFirma', () => {
  const base = { requestId: REQUEST_ID, dataId: DATA_ID, secreto: SECRETO };

  test('una firma bien hecha pasa', async () => {
    expect(await verificarFirma({ ...base, cabeceraFirma: cabecera(MANIFIESTO) })).toEqual({ ok: true });
  });

  test('sin x-request-id la firma se hace sin ese segmento y también pasa', async () => {
    const sin = `id:${DATA_ID};ts:${TS};`;
    expect(await verificarFirma({ ...base, requestId: null, cabeceraFirma: cabecera(sin) })).toEqual({ ok: true });
  });

  test('otro secreto: no coincide', async () => {
    expect(await verificarFirma({ ...base, cabeceraFirma: cabecera(MANIFIESTO, TS, 'otro-secreto') })).toEqual({ ok: false, motivo: 'no-coincide' });
  });

  test.each([
    ['otro id de pago (alguien reusa una firma para avisar de otro pago)', { dataId: '987654321' }],
    ['otro request-id', { requestId: 'otro-request' }],
  ])('un valor alterado: %s', async (_nombre, cambio) => {
    expect(await verificarFirma({ ...base, ...cambio, cabeceraFirma: cabecera(MANIFIESTO) })).toEqual({ ok: false, motivo: 'no-coincide' });
  });

  test('un ts alterado en la cabecera: no coincide', async () => {
    const v1 = firmar(MANIFIESTO);
    expect(await verificarFirma({ ...base, cabeceraFirma: `ts=1704908999,v1=${v1}` })).toEqual({ ok: false, motivo: 'no-coincide' });
  });

  test('FALLA CERRADO sin secreto: ni siquiera una firma hecha con el secreto vacío pasa', async () => {
    for (const vacio of [undefined, null, '', '   ']) {
      const firmadaConVacio = cabecera(MANIFIESTO, TS, '');
      expect(await verificarFirma({ ...base, secreto: vacio as string | undefined, cabeceraFirma: firmadaConVacio })).toEqual({ ok: false, motivo: 'sin-secreto' });
    }
  });

  test('sin cabecera de firma', async () => {
    expect(await verificarFirma({ ...base, cabeceraFirma: null })).toEqual({ ok: false, motivo: 'sin-firma' });
    expect(await verificarFirma({ ...base, cabeceraFirma: '' })).toEqual({ ok: false, motivo: 'sin-firma' });
  });

  test('cabecera mal formada', async () => {
    expect(await verificarFirma({ ...base, cabeceraFirma: 'basura' })).toEqual({ ok: false, motivo: 'firma-mal-formada' });
  });

  test('sin id de pago no hay nada a qué atar la firma: no pasa, ni con una firma legítima del resto', async () => {
    // Sin el id el manifiesto omite ese segmento, así que una firma válida de `request-id` y `ts` coincidiría: por eso se exige el id aparte.
    const sinId = `request-id:${REQUEST_ID};ts:${TS};`;
    expect(await verificarFirma({ ...base, dataId: null, cabeceraFirma: cabecera(sinId) })).toEqual({ ok: false, motivo: 'sin-id' });
    expect(await verificarFirma({ ...base, dataId: '', cabeceraFirma: cabecera(sinId) })).toEqual({ ok: false, motivo: 'sin-id' });
  });
});

describe('extraerAviso', () => {
  const url = (q: string) => `https://proyecto.supabase.co/functions/v1/mp-webhook${q}`;

  test('un aviso de pago: el id sale de la query (es lo que cubre la firma)', () => {
    expect(extraerAviso(url('?data.id=123456&type=payment'), { type: 'payment', data: { id: '999' } })).toEqual({ tipo: 'pago', dataId: '123456' });
  });
  test('sin id en la query, se usa el del cuerpo', () => {
    expect(extraerAviso(url('?type=payment'), { type: 'payment', data: { id: 123456 } })).toEqual({ tipo: 'pago', dataId: '123456' });
  });
  test('el tipo puede venir en el cuerpo o como `topic`', () => {
    expect(extraerAviso(url('?data.id=1'), { type: 'payment' })).toEqual({ tipo: 'pago', dataId: '1' });
    expect(extraerAviso(url('?data.id=1&topic=payment'), null)).toEqual({ tipo: 'pago', dataId: '1' });
  });
  test.each(['merchant_order', 'plan', 'subscription_preapproval', 'point_integration_wh'])('un aviso de «%s» se ignora (y se contesta 200)', (tipo) => {
    expect(extraerAviso(url(`?data.id=1&type=${tipo}`), { type: tipo }).tipo).toBe('ignorar');
  });
  test.each(['abc', '12 34', '1;drop', '', '9'.repeat(25)])('un id de pago que no es numérico y razonable (%p) es inválido', (id) => {
    expect(extraerAviso(url(`?data.id=${encodeURIComponent(id)}&type=payment`), null).tipo).toBe('invalido');
  });
  test('un pago sin ningún id es inválido', () => {
    expect(extraerAviso(url('?type=payment'), { type: 'payment' }).tipo).toBe('invalido');
  });
  test.each([null, undefined, 'texto', 5, []])('un cuerpo que no es un objeto (%p) no rompe', (cuerpo) => {
    expect(extraerAviso(url('?data.id=1&type=payment'), cuerpo)).toEqual({ tipo: 'pago', dataId: '1' });
  });
  test('una URL imposible de leer es inválida, no una excepción', () => {
    expect(extraerAviso('no es una url', null).tipo).toBe('invalido');
  });
});

describe('decidirPago · lo que cobró Mercado Pago, no lo que diga el aviso', () => {
  const pago = { status: 'approved', external_reference: UUID_ORDEN, transaction_amount: 99, currency_id: 'MXN' };

  test('un pago completo', () => {
    expect(decidirPago(pago)).toEqual({ ok: true, ordenId: UUID_ORDEN, estado: 'approved', montoCentavos: 9900 });
  });
  test('el monto pasa a centavos sin errores de coma flotante', () => {
    expect(decidirPago({ ...pago, transaction_amount: 199 })).toMatchObject({ montoCentavos: 19900 });
    expect(decidirPago({ ...pago, transaction_amount: 99.9 })).toMatchObject({ montoCentavos: 9990 });
    expect(decidirPago({ ...pago, transaction_amount: 0.29 })).toMatchObject({ montoCentavos: 29 });
  });
  test('un monto con fracciones de centavo NO es un precio del catálogo: se rechaza, no se redondea', () => {
    // 1.005 * 100 = 100.49999999999999 en coma flotante: redondear daría 100 o 101 según la suerte. Un cobro así es anómalo y se alerta.
    expect(decidirPago({ ...pago, transaction_amount: 1.005 })).toEqual({ ok: false, motivo: 'monto-invalido' });
    expect(decidirPago({ ...pago, transaction_amount: 99.999 })).toEqual({ ok: false, motivo: 'monto-invalido' });
  });
  test('la referencia se normaliza a minúsculas', () => {
    expect(decidirPago({ ...pago, external_reference: UUID_ORDEN.toUpperCase() })).toMatchObject({ ordenId: UUID_ORDEN });
  });
  test('cualquier estado pasa tal cual: lo decide la base', () => {
    expect(decidirPago({ ...pago, status: 'pending' })).toMatchObject({ estado: 'pending' });
    expect(decidirPago({ ...pago, status: 'refunded' })).toMatchObject({ estado: 'refunded' });
  });
  test.each(['USD', 'mxn', undefined, null, 5])('una moneda que no es MXN (%p) no se procesa', (moneda) => {
    expect(decidirPago({ ...pago, currency_id: moneda })).toEqual({ ok: false, motivo: 'moneda-no-mxn' });
  });
  test.each([undefined, null, '', 'no-es-uuid', 12345, 'a3b1c2d4-0000-4000-8000-123456789abc-extra'])('una referencia que no es una orden (%p) no se procesa', (ref) => {
    expect(decidirPago({ ...pago, external_reference: ref })).toEqual({ ok: false, motivo: 'sin-referencia' });
  });
  test.each([0, -5, NaN, Infinity, '99', null, undefined])('un monto inválido (%p) no se procesa', (monto) => {
    expect(decidirPago({ ...pago, transaction_amount: monto })).toEqual({ ok: false, motivo: 'monto-invalido' });
  });
  test.each([null, undefined, 'texto', 5, [], { status: 5 }, { ...pago, status: undefined }])('un pago mal formado (%p) no se procesa', (p) => {
    expect(decidirPago(p).ok).toBe(false);
  });
});

describe('respuestaDeRegistro · qué contesta el webhook a Mercado Pago', () => {
  test.each(['activado', 'duplicado', 'pendiente', 'rechazado', 'ignorado'])('«%s» es un resultado normal: 200', (r) => {
    expect(respuestaDeRegistro(r)).toMatchObject({ status: 200, nivel: 'info' });
  });
  test.each(['monto_distinto', 'orden_inexistente'])('«%s» no se va a arreglar reintentando: 200, pero con ALERTA en el registro', (r) => {
    expect(respuestaDeRegistro(r)).toMatchObject({ status: 200, nivel: 'alerta' });
  });
  test.each(['', 'algo_nuevo', undefined, null, 5])('un resultado que la función no conoce (%p) es un 500: que reintente en vez de perder el pago', (r) => {
    expect(respuestaDeRegistro(r as string)).toMatchObject({ status: 500, nivel: 'alerta' });
  });
});

// Paso 3: lo que el webhook decide con lo que le contesta Mercado Pago y con lo que no puede procesar. La regla de oro es la misma de siempre: lo que
// un reintento puede arreglar es un 500 (Mercado Pago reintenta cada 15 minutos), y lo que no, un 200 con su registro — nunca al revés.
describe('clasificarConsultaPago · la respuesta de GET /v1/payments/{id}', () => {
  const pago = { id: 123, status: 'approved' };

  test('un 200 con un objeto: se procesa ESE pago, el que devolvió Mercado Pago', () => {
    expect(clasificarConsultaPago(200, pago)).toEqual({ accion: 'procesar', pago });
  });

  test.each([null, undefined, 'texto', 5, []])('un 200 con una forma inesperada (%p) es un 500: que reintente', (cuerpo) => {
    expect(clasificarConsultaPago(200, cuerpo)).toEqual({ accion: 'responder', status: 500, nivel: 'alerta', etiqueta: 'consulta-mal-formada' });
  });

  test('un 404: el pago no existe (la «Simular notificación» del panel manda un id inventado). Reintentar no lo arregla: 200', () => {
    expect(clasificarConsultaPago(404, { message: 'Payment not found' })).toEqual({ accion: 'responder', status: 200, nivel: 'info', etiqueta: 'pago-inexistente' });
  });

  test.each([401, 403])('un %i: el token de Mercado Pago no sirve. Es de configuración y se arregla con el token bueno: 500 con alerta', (estado) => {
    expect(clasificarConsultaPago(estado, null)).toEqual({ accion: 'responder', status: 500, nivel: 'alerta', etiqueta: 'credencial-rechazada' });
  });

  test.each([429, 500, 502, 503, 504])('un %i es transitorio: 500, que reintente', (estado) => {
    expect(clasificarConsultaPago(estado, null)).toEqual({ accion: 'responder', status: 500, nivel: 'alerta', etiqueta: 'mp-no-disponible' });
  });

  test.each([400, 410, 422])('otro 4xx (%i) no se arregla reintentando: 200 con alerta', (estado) => {
    expect(clasificarConsultaPago(estado, null)).toEqual({ accion: 'responder', status: 200, nivel: 'alerta', etiqueta: 'consulta-rechazada' });
  });

  test.each([100, 301, 302])('un %i es inesperado: 500', (estado) => {
    expect(clasificarConsultaPago(estado, null)).toMatchObject({ accion: 'responder', status: 500, nivel: 'alerta' });
  });
});

describe('respuestaDeDecisionFallida · un pago que no se puede convertir en una orden', () => {
  test('sin referencia a una orden: es un pago de esa cuenta que no es de este flujo (200, sin alarma)', () => {
    expect(respuestaDeDecisionFallida('sin-referencia')).toEqual({ status: 200, nivel: 'info', etiqueta: 'pago-ajeno' });
  });
  test.each(['moneda-no-mxn', 'monto-invalido'])('«%s» es anómalo y reintentar no lo cambia: 200 con ALERTA', (motivo) => {
    expect(respuestaDeDecisionFallida(motivo)).toEqual({ status: 200, nivel: 'alerta', etiqueta: motivo });
  });
  test('un pago mal formado puede ser un tropiezo de Mercado Pago: 500, que reintente', () => {
    expect(respuestaDeDecisionFallida('pago-mal-formado')).toEqual({ status: 500, nivel: 'alerta', etiqueta: 'pago-mal-formado' });
  });
  test('un motivo que no conoce NO se traga: 500 con alerta', () => {
    expect(respuestaDeDecisionFallida('algo-nuevo')).toMatchObject({ status: 500, nivel: 'alerta' });
  });
});

describe('respuestaDeFirmaFallida · el aviso no demostró venir de Mercado Pago', () => {
  test('sin secreto configurado es NUESTRO fallo: 503 con alerta (Mercado Pago reintentará cuando esté puesto)', () => {
    expect(respuestaDeFirmaFallida('sin-secreto')).toEqual({ status: 503, nivel: 'alerta', etiqueta: 'sin-secreto' });
  });
  test('una firma que NO coincide es 401 con ALERTA: o alguien falsifica, o el secreto del panel y el de Supabase no son el mismo y no entra ningún aviso', () => {
    expect(respuestaDeFirmaFallida('no-coincide')).toEqual({ status: 401, nivel: 'alerta', etiqueta: 'no-coincide' });
  });
  test.each(['sin-firma', 'firma-mal-formada', 'sin-id'])('«%s» es un 401 sin alarma: cualquiera puede mandar basura a una URL pública', (motivo) => {
    expect(respuestaDeFirmaFallida(motivo)).toEqual({ status: 401, nivel: 'info', etiqueta: motivo });
  });
  test('un motivo que no conoce NO deja pasar: 401', () => {
    expect(respuestaDeFirmaFallida('algo-nuevo').status).toBe(401);
  });
});
