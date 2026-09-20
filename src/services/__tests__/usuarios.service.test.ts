// END-22 · `src/services` estaba al 3.7 %. No es un detalle de higiene: es la
// capa que decide QUE datos salen de la base y cuales no, y la que implementa
// los derechos ARCO que el aviso de privacidad promete.
//
// Estas pruebas no persiguen el porcentaje. Cada una fija una decision que, si
// se revierte, no rompe nada visible hasta que ya es tarde.

const mockDesde = jest.fn();
const mockRpc = jest.fn();
const mockInvocar = jest.fn();
const mockCerrarSesion = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockDesde(...a),
    rpc: (...a: unknown[]) => mockRpc(...a),
    functions: { invoke: (...a: unknown[]) => mockInvocar(...a) },
    auth: { signOut: (...a: unknown[]) => mockCerrarSesion(...a) },
  },
}));

import {
  eliminarMiCuenta,
  obtenerAfinidadRoomie,
  exportarMisDatos,
  obtenerPerfilPublico,
  obtenerPerfilesPublicos,
  reportarUsuario,
} from '../usuarios.service';

/** Doble encadenable: `.select().eq().maybeSingle()` y tambien `await` directo
 *  sobre el constructor, que es como lo usan varias de estas funciones. */
function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'in', 'insert', 'update', 'upsert', 'order', 'limit', 'not', 'is']) {
    c[metodo] = jest.fn(() => c);
  }
  c.maybeSingle = jest.fn(async () => resultado);
  c.single = jest.fn(async () => resultado);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => {
  mockDesde.mockReset();
  mockRpc.mockReset();
  mockInvocar.mockReset();
  mockCerrarSesion.mockReset().mockResolvedValue({ error: null });
});

// LA prueba de este archivo. v3 hacia `from('usuarios').select('*')` confiando
// en que RLS lo protegia, y ese era el error central del documento: RLS filtra
// FILAS, no COLUMNAS. Esa consulta bajaba el presupuesto, la universidad y el
// vector de perfil de todo el padron.
//
// Si alguien «optimiza» esto de vuelta a la tabla, hoy devolveria null y
// pareceria un bug de datos. Esta asercion nombra la causa.
test('el perfil ajeno sale de la VISTA, nunca de la tabla usuarios', async () => {
  mockDesde.mockReturnValue(cadena({ data: { id: 'u1' }, error: null }));
  await obtenerPerfilPublico('u1');
  expect(mockDesde).toHaveBeenCalledWith('perfiles_publicos');
  expect(mockDesde).not.toHaveBeenCalledWith('usuarios');
});

test('sin ids no se consulta nada: se devuelve la lista vacia', async () => {
  const r = await obtenerPerfilesPublicos([]);
  expect(r).toEqual([]);
  expect(mockDesde).not.toHaveBeenCalled();
});

test('varios perfiles salen tambien de la vista', async () => {
  mockDesde.mockReturnValue(cadena({ data: [{ id: 'a' }, { id: 'b' }], error: null }));
  const r = await obtenerPerfilesPublicos(['a', 'b']);
  expect(mockDesde).toHaveBeenCalledWith('perfiles_publicos');
  expect(r).toHaveLength(2);
});

// §27 · Un fallo de lectura NO puede presentarse como «no hay perfil». Es el
// mismo defecto que END-11 describia en dos pantallas.
test('un error se propaga, no se disfraza de perfil inexistente', async () => {
  mockDesde.mockReturnValue(cadena({ data: null, error: { message: 'network error' } }));
  await expect(obtenerPerfilPublico('u1')).rejects.toMatchObject({ message: 'network error' });
});

test('un perfil que no existe devuelve null sin lanzar', async () => {
  mockDesde.mockReturnValue(cadena({ data: null, error: null }));
  await expect(obtenerPerfilPublico('fantasma')).resolves.toBeNull();
});

test('reportar inserta en reportes con los tres campos', async () => {
  const c = cadena({ error: null });
  mockDesde.mockReturnValue(c);
  await reportarUsuario('yo', 'otro', 'contenido sospechoso');
  expect(mockDesde).toHaveBeenCalledWith('reportes');
  expect(c.insert).toHaveBeenCalledWith({
    reportado_por: 'yo',
    usuario_reportado_id: 'otro',
    motivo: 'contenido sospechoso',
  });
});

test('exportar mis datos va por la RPC, no por una lectura de tablas', async () => {
  mockRpc.mockResolvedValue({ data: { usuario: {} }, error: null });
  await exportarMisDatos();
  expect(mockRpc).toHaveBeenCalledWith('exportar_mis_datos');
});

// ARCO · CANCELACION. El orden importa y no es obvio.
test('borrar la cuenta cierra la sesion DESPUES de que la funcion respondio', async () => {
  mockInvocar.mockResolvedValue({ error: null });
  await eliminarMiCuenta();
  expect(mockInvocar).toHaveBeenCalledWith('eliminar-cuenta', { body: {} });
  expect(mockCerrarSesion).toHaveBeenCalled();
});

// LA otra prueba que importa. Si el borrado falla y la sesion se cierra igual,
// la persona queda FUERA de una cuenta que sigue existiendo, con sus datos
// intactos y sin forma de reintentar desde dentro. Creeria que se borro.
test('si el borrado falla NO se cierra la sesion', async () => {
  mockInvocar.mockResolvedValue({ error: { message: 'boom' } });
  await expect(eliminarMiCuenta()).rejects.toMatchObject({ message: 'boom' });
  expect(mockCerrarSesion).not.toHaveBeenCalled();
});


// ═══════════════════════════════════════════════════════════════════════════
// La afinidad de una PERSONA · el mismo numero que ordeno la lista
// ═══════════════════════════════════════════════════════════════════════════

test('la afinidad se pide por el id de la otra persona, sin pasar el mio', async () => {
  mockRpc.mockResolvedValue({ data: [{ similitud: 0.87, nivel: 2 }], error: null });
  await obtenerAfinidadRoomie('u2');
  expect(mockRpc).toHaveBeenCalledWith('afinidad_roomie_de', { p_usuario_id: 'u2' });
});

// `auth.uid()` se fija DENTRO de la funcion (migracion 0039). Si la firma
// aceptara un «yo», cualquiera podria pedir la afinidad entre otras dos
// personas — que es el agujero que la 0036 encontro en `afinidad_de_para`.
test('la llamada no lleva un parametro de «yo»', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });
  await obtenerAfinidadRoomie('u2');
  const [, argumentos] = mockRpc.mock.calls[0];
  expect(Object.keys(argumentos)).toEqual(['p_usuario_id']);
});

test('devuelve la primera fila, que es la unica que la funcion produce', async () => {
  mockRpc.mockResolvedValue({ data: [{ similitud: 0.5, nivel: 2 }], error: null });
  await expect(obtenerAfinidadRoomie('u2')).resolves.toEqual({ similitud: 0.5, nivel: 2 });
});

// Null y no cero: cero seria una afinidad MEDIDA —dos vectores ortogonales— y
// esto es su ausencia. Confundirlas pintaria un 0.0 donde no hay dato.
test('sin vector, la similitud es null y el nivel 1', async () => {
  mockRpc.mockResolvedValue({ data: [{ similitud: null, nivel: 1 }], error: null });
  await expect(obtenerAfinidadRoomie('u2')).resolves.toEqual({ similitud: null, nivel: 1 });
});

test('una respuesta sin filas devuelve null, no revienta', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });
  await expect(obtenerAfinidadRoomie('u2')).resolves.toBeNull();
});

test('un error se propaga: la pantalla lo distingue de «no hay afinidad»', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'sin red' } });
  await expect(obtenerAfinidadRoomie('u2')).rejects.toMatchObject({ message: 'sin red' });
});
