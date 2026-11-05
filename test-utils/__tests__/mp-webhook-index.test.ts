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

// ── Registro de eventos (0081) ──────────────────────────────────────────────
// Cada aviso con la firma ya VERIFICADA deja su resultado en `eventos_pago` para el panel. La URL es pública: si se escribiera antes de verificar, cualquiera llenaría la tabla.
// Los argumentos EXACTOS de la llamada (hasta su cierre) y el cuerpo de `cerrar`: nada de código vecino.
const argumentosEvento = (() => {
  const i = fuente.indexOf("rpc('registrar_evento_pago'");
  return i === -1 ? '' : fuente.slice(i, fuente.indexOf('});', i) + 3);
})();
const cuerpoDeCerrar = (() => {
  const i = fuente.indexOf('const cerrar = async');
  return i === -1 ? '' : fuente.slice(i, fuente.indexOf('return responder(r, extra);', i) + 30);
})();

test('registra el resultado de cada aviso mediante la función de la base', () => {
  expect(fuente).toContain("rpc('registrar_evento_pago'");
});

test('solo se registra DESPUÉS de verificar la firma (ni una sola escritura antes)', () => {
  const iFirma = donde('verificarFirma(');
  expect(donde("rpc('registrar_evento_pago'")).toBeGreaterThan(iFirma);
  expect(fuente.slice(0, iFirma)).not.toContain('registrar_evento_pago');
});

test('lo que se guarda es la etiqueta, el nivel, el código y el id numérico: nunca el cuerpo, las cabeceras ni la firma', () => {
  expect(argumentosEvento).toMatch(/p_etiqueta:\s*r\.etiqueta/);
  expect(argumentosEvento).toMatch(/p_nivel:\s*r\.nivel/);
  expect(argumentosEvento).toMatch(/p_status:\s*r\.status/);
  expect(argumentosEvento).toMatch(/p_pago_id:\s*aviso\.dataId/);
  expect(argumentosEvento).not.toMatch(/cuerpo|x-signature|headers|secreto|Authorization|firma/i);
});

test('un fallo al registrar NUNCA cambia lo que se le contesta a Mercado Pago', () => {
  expect(cuerpoDeCerrar).toMatch(/try \{/);
  expect(cuerpoDeCerrar).toMatch(/catch/);
  expect(cuerpoDeCerrar).toMatch(/console\.error/);
  // La respuesta sale del `responder(...)`, nunca del resultado del registro.
  expect(cuerpoDeCerrar.trimEnd()).toMatch(/return responder\(r, extra\);$/);
});
