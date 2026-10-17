import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { useToastStore } from '@/store/useToastStore';

// `perfil/[usuarioId].tsx` · el perfil AJENO. Tenía 28 de 54 ramas sin cubrir, y
// es la pantalla con el riesgo de privacidad más directo del producto: lo que se
// pinta aquí es lo que un extraño puede ver de otra persona.
//
// v3 hacía `from('usuarios').select('*')` y pintaba el rango de presupuesto de
// cualquiera, porque su RLS filtraba FILAS y no COLUMNAS. La corrección fue la
// vista `perfiles_publicos`, que no trae esas columnas. Lo que esta pantalla
// pinta es la segunda mitad de esa corrección, y no lo comprobaba nada.
//
// Y la otra propiedad que importa está escrita en un comentario del archivo: la
// afinidad va en SU PROPIA petición y su propio estado, para que un fallo al
// calcularla NO deje la pantalla sin perfil. Un dato accesorio que tumba al
// principal es exactamente el modo de fallo que este proyecto persigue.

const mockPerfilPublico = jest.fn();
const mockAfinidad = jest.fn();
const mockAbrirConversacion = jest.fn();
const mockReportar = jest.fn();
const mockPush = jest.fn();
const mockReducido = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => ({ usuarioId: 'otro1' }),
  Stack: { Screen: () => null },
}));
jest.mock('@/services/usuarios.service', () => ({
  obtenerPerfilPublico: (...a: unknown[]) => mockPerfilPublico(...a),
  obtenerAfinidadRoomie: (...a: unknown[]) => mockAfinidad(...a),
  reportarUsuario: (...a: unknown[]) => mockReportar(...a),
}));
jest.mock('@/services/mensajes.service', () => ({
  abrirConversacion: (...a: unknown[]) => mockAbrirConversacion(...a),
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({
  useFotosFirmadas: (rutas: (string | null | undefined)[]) => ({
    urls: new Map(rutas.filter(Boolean).map((r) => [r, `https://firmada.test/${r}`])),
    fallo: null,
  }),
}));
jest.mock('@/hooks/use-movimiento-reducido', () => ({
  useMovimientoReducido: (...a: unknown[]) => mockReducido(...a),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

import PerfilPublicoScreen from '../[usuarioId]';

const PERFIL = {
  id: 'otro1',
  usuario_id: 'otro1',
  nombre_completo: 'Ana Pérez',
  nombre_usuario: 'ana',
  biografia: 'Estudio mecatrónica y tengo un gato.',
  foto_url: null,
  nivel_ruido: 'bajo',
  // `diurno` y no «matutino»: el `check` de la migración 0009 solo admite
  // ('diurno','nocturno','mixto'). Mi primera versión de este fixture usaba un
  // valor que la base rechazaría, con lo que todas las pruebas del archivo
  // venían pintando el respaldo de la etiqueta sin que yo lo supiera.
  horario_predominante: 'diurno',
  mascotas: true,
  fuma: false,
  correo_verificado: true,
};

const pintar = async () => {
  const vista = await render(<PerfilPublicoScreen />);
  // Las dos peticiones salen en efectos: se espera a que la ficha exista.
  await waitFor(() => expect(mockPerfilPublico).toHaveBeenCalled());
  return vista;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useToastStore.setState({ actual: null });
  mockPerfilPublico.mockResolvedValue(PERFIL);
  mockAfinidad.mockResolvedValue({ similitud: 0.82, nivel: 2 });
  mockAbrirConversacion.mockResolvedValue('conv-1');
  mockReportar.mockResolvedValue(undefined);
  mockReducido.mockReturnValue(false);
});

// ── §25 · lo que un extraño NO debe ver ──────────────────────────────────────

// La prueba de privacidad. Se le da a la pantalla un objeto que SÍ trae
// presupuesto y universidad —como si alguien añadiera esas columnas a la vista
// `perfiles_publicos` sin pensarlo, que es el error que v3 ya cometió una vez— y
// se comprueba que aun así no las pinta. La vista es la primera defensa; esto es
// la segunda, y hasta ahora no existía.
test('no pinta presupuesto ni universidad aunque lleguen en el objeto', async () => {
  mockPerfilPublico.mockResolvedValue({
    ...PERFIL,
    presupuesto_min: 2000,
    presupuesto_max: 5000,
    universidad: 'Universidad Tecnológica del Valle de Toluca (UTVT)',
  });
  await pintar();
  await waitFor(() => expect(screen.getByText('Ana Pérez')).toBeTruthy());

  expect(screen.queryByText(/5,?000/)).toBeNull();
  expect(screen.queryByText(/2,?000/)).toBeNull();
  expect(screen.queryByText(/UTVT/)).toBeNull();
  expect(screen.queryByText(/PRESUPUESTO/i)).toBeNull();
  expect(screen.queryByText(/UNIVERSIDAD/i)).toBeNull();
});

// Se consulta por la vista de lista blanca, con el id de la ruta. Si algún día
// alguien la cambiara por `usuarios`, RLS filtraría la fila pero no la columna y
// volvería el defecto de v3 entero.
test('pide el perfil público del usuario de la ruta', async () => {
  await pintar();
  expect(mockPerfilPublico).toHaveBeenCalledWith('otro1');
});

// ── La afinidad, que es accesoria ────────────────────────────────────────────

test('muestra la afinidad cuando se pudo calcular', async () => {
  await pintar();
  await waitFor(() => expect(mockAfinidad).toHaveBeenCalledWith('otro1'));
  expect(await screen.findByText('Ana Pérez')).toBeTruthy();
});

// LA prueba de este bloque. Va en su propia petición justamente para esto: si
// colgara del mismo `then` que el perfil, un fallo al calcular la afinidad
// dejaría la pantalla SIN PERFIL — el dato accesorio tumbando al principal.
test('si la afinidad falla, el perfil se pinta igual', async () => {
  mockAfinidad.mockRejectedValue(new Error('la RPC de afinidad no respondió'));
  await pintar();

  expect(await screen.findByText('Ana Pérez')).toBeTruthy();
  expect(screen.getByText(/Estudio mecatrónica/)).toBeTruthy();
  expect(screen.queryByText('No se encontró este perfil.')).toBeNull();
});

// Y al contrario: si el perfil falla, no se pinta una ficha a medias con la
// afinidad de alguien que no se pudo cargar.
test('si el perfil falla, se dice que no se encontró', async () => {
  mockPerfilPublico.mockRejectedValue(new Error('sin red'));
  await pintar();
  expect(await screen.findByText('No se encontró este perfil.')).toBeTruthy();
});

test('un perfil inexistente también lo dice', async () => {
  mockPerfilPublico.mockResolvedValue(null);
  await pintar();
  expect(await screen.findByText('No se encontró este perfil.')).toBeTruthy();
});

// ── El chat · AUD-07 ─────────────────────────────────────────────────────────

// La conversación la abre una función de Postgres, no un insert desde el
// cliente: dos personas tocando a la vez reciben el MISMO identificador en vez
// de que la segunda vea un error de índice único justo al iniciar el chat.
test('iniciar chat va por la RPC y navega al hilo que devuelve', async () => {
  await pintar();
  const boton = await screen.findByLabelText('Iniciar chat con Ana Pérez');
  await act(async () => {
    fireEvent.press(boton);
  });

  await waitFor(() => expect(mockAbrirConversacion).toHaveBeenCalledWith('otro1'));
  expect(mockPush).toHaveBeenCalledWith('/chat/conv-1');
});

// Iniciar el chat SÍ compromete —crea la fila en `conversaciones`—, así que dos
// toques seguidos no deben hacerlo dos veces.
test('dos toques abren una sola conversación', async () => {
  let resolver!: (v: string) => void;
  mockAbrirConversacion.mockReturnValue(new Promise((r) => { resolver = r; }));
  await pintar();
  const boton = await screen.findByLabelText('Iniciar chat con Ana Pérez');

  await act(async () => { fireEvent.press(boton); });
  await act(async () => { fireEvent.press(boton); });
  expect(mockAbrirConversacion).toHaveBeenCalledTimes(1);

  await act(async () => { resolver('conv-1'); });
});

// Un fallo al abrir se dice y NO se navega: llevar a `/chat/undefined` dejaría a
// la persona en una pantalla vacía después de haber pulsado.
test('si la persona ya no está disponible se dice así y no se navega', async () => {
  // `abrir_conversacion` falla con `raise exception` (P0001) cuando el destinatario ya no está activo.
  mockAbrirConversacion.mockRejectedValue({ code: 'P0001', message: 'usuario no disponible' });
  await pintar();
  const boton = await screen.findByLabelText('Iniciar chat con Ana Pérez');
  await act(async () => { fireEvent.press(boton); });

  // Paso 3 · se AVISA, no se pregunta. El diálogo que se queda es el de reportar.
  await waitFor(() => expect(useToastStore.getState().actual).not.toBeNull());
  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'error',
    mensaje: 'No se pudo abrir el chat. Esta persona ya no está disponible.',
  });
  expect(mockPush).not.toHaveBeenCalled();
});

// END-11 · antes TODO fallo decía «esta persona ya no está disponible», incluida una caída de red.
test('un fallo de red NO dice que la persona ya no está disponible', async () => {
  mockAbrirConversacion.mockRejectedValue(new Error('Network request failed'));
  await pintar();
  const boton = await screen.findByLabelText('Iniciar chat con Ana Pérez');
  await act(async () => { fireEvent.press(boton); });
  await waitFor(() => expect(useToastStore.getState().actual).not.toBeNull());
  const mensaje = String((useToastStore.getState().actual as { mensaje: string }).mensaje);
  expect(mensaje).toMatch(/conexi/i);
  expect(mensaje).not.toMatch(/ya no está disponible/i);
  expect(mockPush).not.toHaveBeenCalled();
});

// ── El reporte ───────────────────────────────────────────────────────────────

const abrirReporte = async () => {
  await pintar();
  const boton = await screen.findByLabelText('Reportar usuario');
  await act(async () => { fireEvent.press(boton); });
  const llamada = (Alert.alert as jest.Mock).mock.calls.find(([t]) => t === 'Reportar usuario');
  return llamada?.[2] as { text: string; onPress?: () => unknown }[];
};

test('reportar pregunta el motivo antes de enviar', async () => {
  const botones = await abrirReporte();
  expect(botones.map((b) => b.text)).toEqual([
    'Cancelar', 'Comportamiento sospechoso', 'Información falsa',
  ]);
  expect(mockReportar).not.toHaveBeenCalled();
});

// El acuse dice QUÉ pasa, no solo «gracias». Y no es un detalle de redacción:
// hasta la migración 0023 este acuse era FALSO —el trigger salía sin hacer nada
// para los reportes de personas—, así que la app agradecía por algo que no
// ocurría. El texto es ahora una afirmación comprobable, y esto la fija.
test('el acuse dice qué pasa al tercer reporte, y avisa de buscar ayuda', async () => {
  const botones = await abrirReporte();
  await act(async () => {
    await botones.find((b) => b.text === 'Comportamiento sospechoso')?.onPress?.();
  });

  const [titulo, cuerpo] = (Alert.alert as jest.Mock).mock.calls.at(-1) as [string, string];
  expect(titulo).toBe('Reporte registrado');
  expect(cuerpo).toContain('tercer reporte');
  expect(cuerpo).toContain('se suspende');
  // Lo que ninguna app de este tipo debería omitir.
  expect(cuerpo).toMatch(/no uses solo esta app/i);
});

test('el motivo elegido viaja con quién reporta y a quién', async () => {
  const botones = await abrirReporte();
  await act(async () => {
    await botones.find((b) => b.text === 'Información falsa')?.onPress?.();
  });
  expect(mockReportar).toHaveBeenCalledWith('u1', 'otro1', 'información falsa');
});

// El índice `reportes_unico_usuario` existe para que una sola cuenta no pueda
// empujar el contador hasta la suspensión. 23505 es su código.
test('un reporte repetido se reconoce por el código 23505', async () => {
  mockReportar.mockRejectedValue({ code: '23505', message: 'duplicate key value violates unique constraint' });
  const botones = await abrirReporte();
  await act(async () => {
    await botones.find((b) => b.text === 'Información falsa')?.onPress?.();
  });
  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'error',
    mensaje: 'No se pudo enviar el reporte. Ya habías reportado a esta persona.',
  });
});

test('otro fallo al reportar da el mensaje genérico', async () => {
  mockReportar.mockRejectedValue(new Error('sin red'));
  const botones = await abrirReporte();
  await act(async () => {
    await botones.find((b) => b.text === 'Información falsa')?.onPress?.();
  });
  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'error',
    mensaje: 'No se pudo enviar el reporte. Intenta de nuevo en un momento.',
  });
});

// ── La ficha de convivencia ──────────────────────────────────────────────────

test('las preferencias se dicen por los dos lados', async () => {
  await pintar();
  expect(await screen.findByText('Sí tiene')).toBeTruthy();
  expect(screen.getByText('No fuma')).toBeTruthy();
});

test('sin datos de convivencia no se queda en blanco', async () => {
  mockPerfilPublico.mockResolvedValue({
    ...PERFIL, nivel_ruido: null, horario_predominante: null, mascotas: false, fuma: false,
  });
  await pintar();
  await waitFor(() => expect(screen.getByText('Ana Pérez')).toBeTruthy());
  expect(screen.getByText('No tiene')).toBeTruthy();
  expect(screen.getByText('No fuma')).toBeTruthy();
});

test('sin biografía no se pinta esa sección', async () => {
  mockPerfilPublico.mockResolvedValue({ ...PERFIL, biografia: null });
  await pintar();
  await waitFor(() => expect(screen.getByText('Ana Pérez')).toBeTruthy());
  expect(screen.queryByText('SOBRE MÍ')).toBeNull();
});

test('con foto firmada se pinta la imagen', async () => {
  mockPerfilPublico.mockResolvedValue({ ...PERFIL, foto_url: 'otro1/a.jpg' });
  await pintar();
  expect(await screen.findByText('Ana Pérez')).toBeTruthy();
});

// ── D.9 · movimiento reducido ────────────────────────────────────────────────

// `reducido !== false` cubre el «todavía no sé»: mientras la preferencia del
// sistema no ha llegado, NO se anima. Sin eso, quien pidió no ver movimiento
// vería el fundido arrancar y cortarse, que es peor que no animar nada.
test('mientras no se sabe la preferencia de movimiento, no anima', async () => {
  mockReducido.mockReturnValue(undefined);
  await pintar();
  expect(await screen.findByText('Ana Pérez')).toBeTruthy();
});

test('con movimiento reducido activo tampoco anima', async () => {
  mockReducido.mockReturnValue(true);
  await pintar();
  expect(await screen.findByText('Ana Pérez')).toBeTruthy();
});

// Un valor que no esté en el mapa de etiquetas —una migración añade 'nocturno' y
// nadie actualiza `ETIQUETA_HORARIO`— no debe pintar «undefined» en la ficha de
// otra persona. Cae a un respaldo que al menos no miente. Es el mismo caso que
// el tipo desconocido del detalle de publicación.
test('un valor desconocido no pinta «undefined»', async () => {
  // Valores que el `check` de la 0009 hoy no permite: solo pueden aparecer si una
  // migración amplía la lista y nadie toca estos mapas. Eso es exactamente lo
  // que el respaldo defiende, y es un escenario realista — el `check` se amplía
  // en una migración y las etiquetas viven en otro archivo.
  mockPerfilPublico.mockResolvedValue({
    ...PERFIL, nivel_ruido: 'ensordecedor', horario_predominante: 'madrugada',
  });
  await pintar();
  await waitFor(() => expect(screen.getByText('Ana Pérez')).toBeTruthy());

  expect(screen.queryByText('undefined')).toBeNull();
  expect(screen.getByText('Sin especificar')).toBeTruthy();
  expect(screen.getByText('Variable')).toBeTruthy();
});
