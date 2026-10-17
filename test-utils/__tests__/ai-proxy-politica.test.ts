import { readFileSync } from 'node:fs';

import {
  clasificarRespuesta,
  secretsFaltantes,
} from '../../supabase/functions/ai-proxy/politica';

// ai-proxy · dos defectos del mismo tipo: la función decidía mal QUÉ hacer con la
// cuota y con una configuración incompleta.
//
//  1. Sin AI_SERVICE_URL el fetch iba a `undefined/parsear-perfil`; sin
//     AI_SHARED_TOKEN mandaba «Bearer undefined». Fallaba, sí, pero tarde, tras
//     cobrar cuota y con un 401 del microservicio que la app podía leer como
//     «tu sesión caducó». Debe fallar CERRADO y ANTES de cobrar.
//  2. La cuota solo se devolvía con 5xx. Un 401/403/429 del microservicio es culpa
//     de la infraestructura, no de quien llama: cobrar ahí es cobrar por nada.
//
// La política vive en un módulo sin dependencias para poder probarla aquí; la
// Edge Function solo la aplica.

const env = (valores: Record<string, string | undefined>) => (n: string) => valores[n];

describe('secretsFaltantes', () => {
  const completo = {
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'a',
    SUPABASE_SERVICE_ROLE_KEY: 's',
    AI_SERVICE_URL: 'https://t.trycloudflare.com',
    AI_SHARED_TOKEN: 'tok',
  };

  test('con todo configurado no falta nada', () => {
    expect(secretsFaltantes(env(completo))).toEqual([]);
  });

  test.each(['AI_SERVICE_URL', 'AI_SHARED_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'])(
    'detecta %s ausente',
    (nombre) => {
      expect(secretsFaltantes(env({ ...completo, [nombre]: undefined }))).toEqual([nombre]);
    }
  );

  test('una cadena vacía o de espacios cuenta como ausente', () => {
    expect(secretsFaltantes(env({ ...completo, AI_SHARED_TOKEN: '' }))).toEqual(['AI_SHARED_TOKEN']);
    expect(secretsFaltantes(env({ ...completo, AI_SERVICE_URL: '  ' }))).toEqual(['AI_SERVICE_URL']);
  });

  test('lista todos los que faltan, sin valores', () => {
    const r = secretsFaltantes(env({}));
    expect(r).toContain('AI_SERVICE_URL');
    expect(r).toContain('AI_SHARED_TOKEN');
    expect(r.length).toBe(5);
  });
});

describe('clasificarRespuesta', () => {
  test.each([200, 201, 204])('%i se entrega tal cual y se cobra', (estado) => {
    expect(clasificarRespuesta(estado)).toEqual({ tipo: 'entregar' });
  });

  // El microservicio rechazó la ENTRADA: la causa es quien llama, y devolver
  // cuota aquí regalaría llamadas ilimitadas a quien mande basura.
  test.each([400, 422])('%i (entrada rechazada) se entrega y SE COBRA', (estado) => {
    expect(clasificarRespuesta(estado)).toEqual({ tipo: 'entregar' });
  });

  // Un 401/403/404 viene de NUESTRA configuración (token o URL equivocados). Si
  // se reenviara, la app vería un 401 y podría cerrar la sesión de quien no hizo nada.
  test.each([401, 403, 404])('%i es fallo de configuración: se degrada y se devuelve', (estado) => {
    expect(clasificarRespuesta(estado)).toEqual({
      tipo: 'degradar',
      devolver: true,
      motivo: 'servicio-mal-configurado',
    });
  });

  test('429 del microservicio: se degrada y se devuelve', () => {
    expect(clasificarRespuesta(429)).toEqual({
      tipo: 'degradar',
      devolver: true,
      motivo: 'servicio-ocupado',
    });
  });

  test.each([500, 502, 503, 504])('%i es fallo del servicio: se degrada y se devuelve', (estado) => {
    expect(clasificarRespuesta(estado)).toEqual({
      tipo: 'degradar',
      devolver: true,
      motivo: 'servicio-error',
    });
  });

  // Cualquier otro 4xx inesperado (405, 413…) no es culpa de quien llama: el
  // proxy arma la petición, no la persona.
  test('un 4xx inesperado se trata como fallo del servicio', () => {
    expect(clasificarRespuesta(405)).toMatchObject({ tipo: 'degradar', devolver: true });
  });
});

// La política solo vale si la función la USA. Sin esto, alguien puede dejar el
// módulo intacto y volver al código anterior en index.ts sin que nada falle.
describe('index.ts aplica la política', () => {
  const fuente = readFileSync('supabase/functions/ai-proxy/index.ts', 'utf8');

  test('importa la política', () => {
    expect(fuente).toMatch(/from '\.\/politica(\.ts)?'/);
    expect(fuente).toContain('secretsFaltantes');
    expect(fuente).toContain('clasificarRespuesta');
  });

  test('comprueba los secrets ANTES de consumir cuota', () => {
    const iSecrets = fuente.indexOf('secretsFaltantes(');
    const iCuota = fuente.indexOf("rpc('consumir_cuota'");
    expect(iSecrets).toBeGreaterThan(-1);
    expect(iCuota).toBeGreaterThan(-1);
    expect(iSecrets).toBeLessThan(iCuota);
  });

  test('ya no hay `!` ni «Bearer undefined» sobre los secrets del microservicio', () => {
    expect(fuente).not.toMatch(/Deno\.env\.get\('AI_SHARED_TOKEN'\)\}/);
  });
});
