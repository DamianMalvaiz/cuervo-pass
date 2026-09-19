import { aviso, fallo, limpiar, registrarSumidero, textoDeError, type Evento } from '@/lib/registro';

// §29 exige minimización, y un reporte de error es donde más se filtra: viaja
// entero, a un tercero, sin que nadie lo lea antes. Estas pruebas fijan que lo
// sensible no salga, incluso cuando viene anidado — que es como lo entrega
// Supabase.

let recibidos: Evento[] = [];
let quitar: () => void;
beforeEach(() => {
  recibidos = [];
  quitar = registrarSumidero((e) => recibidos.push(e));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { quitar(); jest.restoreAllMocks(); });

test('un aviso llega al sumidero con su nivel', () => {
  aviso('el túnel no respondió');
  expect(recibidos).toHaveLength(1);
  expect(recibidos[0]).toMatchObject({ nivel: 'aviso', mensaje: 'el túnel no respondió' });
});

test('un fallo llega con nivel de error', () => {
  fallo('no se pudo guardar');
  expect(recibidos[0].nivel).toBe('error');
});

test('el texto libre del perfil no sale', () => {
  aviso('guardado', { perfil_texto: 'soy tranquilo y estudio de noche', universidad: 'UTVT' });
  expect(recibidos[0].datos).toEqual({ perfil_texto: '[omitido]', universidad: 'UTVT' });
});

test('el teléfono tampoco', () => {
  aviso('contacto', { whatsapp: '7221599193' });
  expect(recibidos[0].datos?.whatsapp).toBe('[omitido]');
});

// Supabase anida el cuerpo de la petición dos o tres niveles. Limpiar solo el
// primero dejaría pasar justo lo que se quería quitar.
test('limpia en profundidad, no solo el primer nivel', () => {
  aviso('falló', { contexto: { body: { whatsapp: '7221599193', perfil_texto: 'algo' } } });
  const c = recibidos[0].datos?.contexto as Record<string, Record<string, unknown>>;
  expect(c.body.whatsapp).toBe('[omitido]');
  expect(c.body.perfil_texto).toBe('[omitido]');
});

test('los correos se enmascaran dondequiera que aparezcan', () => {
  aviso('no se pudo enviar a ana@utvt.edu.mx desde soporte@cuervopass.mx');
  expect(recibidos[0].mensaje).toBe('no se pudo enviar a [correo] desde [correo]');
});

test('un correo dentro del contexto también', () => {
  aviso('alta', { usuario: { email: 'ana@utvt.edu.mx' } });
  expect((recibidos[0].datos?.usuario as Record<string, string>).email).toBe('[correo]');
});

test('una estructura circular no tumba el registro', () => {
  const a: Record<string, unknown> = { nombre: 'x' };
  a.yo = a;
  expect(() => aviso('circular', a)).not.toThrow();
});

// Un logger que revienta es peor que no tener logger.
test('un sumidero roto no tumba la app ni impide a los demás', () => {
  const quitarRoto = registrarSumidero(() => { throw new Error('sumidero roto'); });
  expect(() => aviso('sigue')).not.toThrow();
  expect(recibidos).toHaveLength(1);
  quitarRoto();
});

test('quitar un sumidero deja de entregarle', () => {
  quitar();
  aviso('ya no');
  expect(recibidos).toHaveLength(0);
  quitar = registrarSumidero((e) => recibidos.push(e));
});

test('limpiar es seguro con valores sueltos', () => {
  expect(limpiar(null)).toBeNull();
  expect(limpiar(42)).toBe(42);
  expect(limpiar(undefined)).toBeUndefined();
});

describe('textoDeError', () => {
  it('saca el mensaje de un Error', () => expect(textoDeError(new Error('boom'))).toBe('boom'));
  it('acepta una cadena', () => expect(textoDeError('boom')).toBe('boom'));
  it('nunca devuelve vacío', () => {
    expect(textoDeError(new Error(''))).toBe('sin detalle');
    expect(textoDeError(undefined)).toBe('sin detalle');
  });
  it('no devuelve [object Object]', () => {
    expect(textoDeError({ code: '23505' })).not.toContain('object Object');
  });
});
