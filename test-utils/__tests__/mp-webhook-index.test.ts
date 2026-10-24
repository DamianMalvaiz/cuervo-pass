import { readFileSync } from 'node:fs';

// La política solo vale si la función la USA, y en el ORDEN correcto. `mp-webhook` es una URL pública que activa planes: el orden de sus pasos es la
// seguridad. Estas pruebas leen `index.ts` y fijan lo que no se puede probar sin Deno ni red:
//   · la firma se verifica ANTES de consultar a Mercado Pago y ANTES de registrar nada;
//   · lo que se registra (orden, monto, estado) sale de la respuesta de Mercado Pago, nunca del cuerpo del aviso;
//   · los secretos nunca llegan a un console;
//   · lo que no se puede procesar no se contesta con un 500 por pereza: cada rama pasa por la política.

const fuente = readFileSync('supabase/functions/mp-webhook/index.ts', 'utf8');
const donde = (texto: string) => fuente.indexOf(texto);

test('usa la política para cada decisión', () => {
  for (const nombre of [
    'extraerAviso(',
    'verificarFirma(',
    'respuestaDeFirmaFallida(',
    'clasificarConsultaPago(',
    'decidirPago(',
    'respuestaDeDecisionFallida(',
    'respuestaDeRegistro(',
  ]) {
    expect(fuente).toContain(nombre);
  }
});

test('falla cerrado: los secretos se comprueban antes que nada que tenga efecto', () => {
  const iSecretos = donde('MP_WEBHOOK_SECRET');
  expect(iSecretos).toBeGreaterThan(-1);
  expect(iSecretos).toBeLessThan(donde('verificarFirma('));
  expect(iSecretos).toBeLessThan(donde('api.mercadopago.com'));
  expect(iSecretos).toBeLessThan(donde("rpc('registrar_pago_mp'"));
});

test('la firma se verifica ANTES de consultar a Mercado Pago y ANTES de registrar el pago', () => {
  const iFirma = donde('verificarFirma(');
  expect(iFirma).toBeGreaterThan(-1);
  expect(iFirma).toBeLessThan(donde('api.mercadopago.com'));
  expect(iFirma).toBeLessThan(donde("rpc('registrar_pago_mp'"));
});

test('la consulta a Mercado Pago va antes del registro, y lleva el id del AVISO ya validado', () => {
  expect(donde('api.mercadopago.com')).toBeLessThan(donde("rpc('registrar_pago_mp'"));
  expect(fuente).toMatch(/api\.mercadopago\.com\/v1\/payments\/\$\{aviso\.dataId\}/);
});

test('orden, monto y estado salen de la DECISIÓN sobre lo que respondió Mercado Pago, no del cuerpo del aviso', () => {
  expect(fuente).toMatch(/p_orden:\s*decision\.ordenId/);
  expect(fuente).toMatch(/p_estado_mp:\s*decision\.estado/);
  expect(fuente).toMatch(/p_monto_centavos:\s*decision\.montoCentavos/);
  expect(fuente).not.toMatch(/p_(orden|estado_mp|monto_centavos):\s*(cuerpo|crudo|aviso)\b/);
});

test('el id del pago que se registra es el del aviso validado', () => {
  expect(fuente).toMatch(/p_mp_payment_id:\s*aviso\.dataId/);
});

test('los secretos y la cabecera de firma nunca llegan a un console', () => {
  const lineasDeConsole = fuente.split('\n').filter((l) => /console\.\w+\(/.test(l));
  expect(lineasDeConsole.length).toBeGreaterThan(0);
  for (const l of lineasDeConsole) {
    expect(l).not.toMatch(/MP_ACCESS_TOKEN|MP_WEBHOOK_SECRET|SERVICE_ROLE|x-signature|Authorization|secreto\b/i);
  }
});

test('no hay CORS: lo llama Mercado Pago desde su servidor, nunca un navegador', () => {
  expect(fuente).not.toContain('Access-Control-Allow-Origin');
});

test('un error al registrar el pago es un 500 (que reintente), no un 200 que lo pierda', () => {
  expect(fuente).toMatch(/if \(eRegistro\)[\s\S]{0,400}status:\s*500|if \(eRegistro\)[\s\S]{0,400}, 500\)/);
});
