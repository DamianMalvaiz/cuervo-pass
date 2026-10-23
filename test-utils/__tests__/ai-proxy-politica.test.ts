import { readFileSync } from 'node:fs';

import {
  clasificarErrorDeCuota,
  clasificarRespuesta,
  secretsFaltantes,
  validarSolicitud,
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


// Hallazgo 4 de la auditoría del 23/10/2026. `ai-proxy` hacía `const { ruta, texto } = await req.json()` sin comprobar que fuera un objeto: un
// cuerpo `null` lanzaba TypeError y la función contestaba 500 (`admin` y `verificar-rostro` sí validan la forma). Y cualquier error al consumir la
// cuota se contestaba 429 «cuota diaria agotada», aunque fuera una caída de la base: un fallo del sistema se leía como un límite del usuario
// (invariante 2: «falló» no es «no hay»).
describe('validarSolicitud', () => {
  test.each([null, undefined, 5, 'texto', true, []])('un cuerpo que no es un objeto (%p) es «cuerpo inválido», no una excepción', (c) => {
    expect(validarSolicitud(c)).toEqual({ ok: false, error: 'cuerpo inválido' });
  });

  test('una solicitud completa pasa', () => {
    expect(validarSolicitud({ ruta: 'generar-embedding', texto: 'hola' })).toEqual({ ok: true, ruta: 'generar-embedding', texto: 'hola' });
    expect(validarSolicitud({ ruta: 'parsear-perfil', texto: 'x'.repeat(2000) }).ok).toBe(true);
  });

  test.each([undefined, 5, null, '', 'otra-ruta', '../admin', 'generar-embedding/../x'])('una ruta fuera de la lista (%p) no pasa', (ruta) => {
    expect(validarSolicitud({ ruta, texto: 'hola' })).toEqual({ ok: false, error: 'ruta no permitida' });
  });

  test.each([undefined, 5, null, '', 'x'.repeat(2001)])('un texto vacío, no textual o de más de 2000 caracteres (%p) no pasa', (texto) => {
    expect(validarSolicitud({ ruta: 'generar-embedding', texto })).toEqual({ ok: false, error: 'texto inválido' });
  });
});

describe('clasificarErrorDeCuota', () => {
  test('solo CP001 (la que lanza consumir_cuota, migración 0032) es «cuota agotada»', () => {
    expect(clasificarErrorDeCuota({ code: 'CP001' })).toBe('agotada');
  });

  test.each([{ code: '23514' }, { code: 'XX000' }, { code: '42501' }, { code: '57014' }, { code: undefined }, {}])(
    'cualquier otro error (%p) NO es un límite: es un fallo del sistema',
    (e) => {
      expect(clasificarErrorDeCuota(e)).toBe('no-disponible');
    },
  );

  test('sin error no hay nada que clasificar como límite', () => {
    expect(clasificarErrorDeCuota(null)).toBe('no-disponible');
    expect(clasificarErrorDeCuota(undefined)).toBe('no-disponible');
  });
});

describe('index.ts aplica la validación y la clasificación de la cuota', () => {
  const fuente = readFileSync('supabase/functions/ai-proxy/index.ts', 'utf8');

  test('valida el cuerpo con la política y ya no lo desestructura a ciegas', () => {
    expect(fuente).toContain('validarSolicitud(');
    expect(fuente).not.toMatch(/const \{ ruta, texto \} = cuerpo;/);
  });

  test('el 429 depende de clasificarErrorDeCuota, no de «hubo algún error»', () => {
    expect(fuente).toContain('clasificarErrorDeCuota(');
    expect(fuente).not.toMatch(/if \(errCuota\) return json\(\{ error: 'cuota diaria agotada' \}, 429\);/);
  });
});
