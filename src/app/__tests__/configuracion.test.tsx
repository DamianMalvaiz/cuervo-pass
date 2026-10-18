import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';

// Cuervo 360 · Configuración (17/10/2026). Aquí viven, desde que salieron del fondo de Mi perfil, los dos
// derechos ARCO que la app promete por escrito —ACCESO («Descargar mis datos») y CANCELACIÓN («Eliminar mi
// cuenta»)— más cerrar sesión y el aviso de privacidad. Las pruebas son las que ya existían, movidas de pantalla:
// que un derecho legal falle callado es peor que no tenerlo, y un botón roto no se arregla probando el backend.

const mockExportar = jest.fn();
const mockEliminarMiCuenta = jest.fn();
const mockCerrarSesion = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: (...a: unknown[]) => mockPush(...a) },
}));
jest.mock('@/services/usuarios.service', () => ({
  exportarMisDatos: (...a: unknown[]) => mockExportar(...a),
  eliminarMiCuenta: (...a: unknown[]) => mockEliminarMiCuenta(...a),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ session: { user: { id: 'u1', email: 'yo@ejemplo.mx' } }, cerrarSesion: mockCerrarSesion }),
}));
const almacen = { consiente: true };
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({ perfil: { id: 'u1', consiente_analisis_ia: almacen.consiente } }),
}));

// «Mi plan» tiene sus propias pruebas; aquí solo importa que Configuración lo monte.
jest.mock('@/components/GrupoMiPlan', () => ({
  GrupoMiPlan: () => {
    const { Text } = require('react-native');
    return <Text>GRUPO MI PLAN</Text>;
  },
}));

import ConfiguracionScreen from '../configuracion';

const pintar = async () => render(<ConfiguracionScreen />);

const pulsar = async (texto: string) => {
  await act(async () => {
    fireEvent.press(screen.getByText(texto));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  almacen.consiente = true;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
  mockExportar.mockResolvedValue({ perfil: { nombre_usuario: 'yo' }, publicaciones: [] });
});

// ── ACCESO · §29 ─────────────────────────────────────────────────────────────

test('exportar entrega LO QUE DEVUELVE el servidor, no un resumen', async () => {
  await pintar();
  await pulsar('Descargar mis datos');

  await waitFor(() => expect(Share.share).toHaveBeenCalled());
  const [{ message, title }] = (Share.share as jest.Mock).mock.calls[0];
  expect(title).toBe('Mis datos en Cuervo 360');
  // Se comprueba el contenido y no solo que se compartió algo: un `Share` con
  // un mensaje vacío satisfaría el derecho de ACCESO sobre el papel y no en la
  // realidad. Y que sea JSON válido, porque se promete «una copia en JSON».
  expect(JSON.parse(message)).toEqual({ perfil: { nombre_usuario: 'yo' }, publicaciones: [] });
});

// El fallo que justifica este archivo: un derecho legal que falla callado.
test('si la exportación falla se DICE, no se queda en silencio', async () => {
  mockExportar.mockRejectedValue(new Error('la RPC no respondió'));
  await pintar();
  await pulsar('Descargar mis datos');

  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  const [titulo, cuerpo] = (Alert.alert as jest.Mock).mock.calls[0];
  expect(titulo).toBe('No se pudieron exportar tus datos');
  expect(cuerpo).toBe('la RPC no respondió');
  expect(Share.share).not.toHaveBeenCalled();
});

// El `finally`. Sin él, un fallo deja `exportando` en true para siempre y con él
// `onPress` en undefined: el renglón queda muerto hasta reiniciar la app.
test('tras un fallo el renglón vuelve a funcionar', async () => {
  mockExportar.mockRejectedValueOnce(new Error('caído')).mockResolvedValue({ perfil: {} });
  await pintar();
  await pulsar('Descargar mis datos');
  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());

  // La descripción vuelve a la de reposo: si se quedara en «Preparando…», el
  // `onPress` seguiría siendo undefined.
  expect(screen.getByText('Una copia en JSON de todo lo que guardamos sobre ti.')).toBeTruthy();
  await pulsar('Descargar mis datos');
  expect(mockExportar).toHaveBeenCalledTimes(2);
});

// Mientras prepara, el renglón se desarma. Exportar dos veces manda dos veces
// TODOS los datos de la persona al selector de compartir.
test('mientras exporta no se puede volver a pulsar', async () => {
  let resolver: (v: unknown) => void = () => {};
  mockExportar.mockReturnValue(new Promise((r) => { resolver = r; }));
  await pintar();
  await pulsar('Descargar mis datos');

  expect(screen.getByText('Preparando el archivo…')).toBeTruthy();
  await pulsar('Descargar mis datos');
  expect(mockExportar).toHaveBeenCalledTimes(1);

  await act(async () => { resolver({ perfil: {} }); });
});

// Cerrar sesión NAVEGA además de cerrar. Si solo cerrara, la pantalla quedaría
// pintada con los datos de alguien que ya no tiene sesión.
test('cerrar sesión cierra y lleva al login', async () => {
  await pintar();
  await pulsar('Cerrar sesión');
  await waitFor(() => expect(mockCerrarSesion).toHaveBeenCalled());
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
});


// El aviso de privacidad es donde la LFPDPPP se cumple por escrito: dice qué se
// guarda, para qué y cómo pedir que se borre. Un enlace roto ahí es del mismo
// género que una exportación que falla callada — la promesa existe y no se puede
// alcanzar.
test('el aviso de privacidad se puede abrir', async () => {
  await pintar();
  await pulsar('Aviso de privacidad');
  expect(mockPush).toHaveBeenCalledWith('/aviso-privacidad');
});

// ── CANCELACIÓN · §29 ────────────────────────────────────────────────────────

const abrirDialogo = async () => {
  await pintar();
  fireEvent.press(await screen.findByLabelText('Eliminar mi cuenta', {}, { timeout: 5000 }));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  return (Alert.alert as jest.Mock).mock.calls[0];
};

test('pedir el borrado abre una confirmacion, no borra de inmediato', async () => {
  await abrirDialogo();
  expect(mockEliminarMiCuenta).not.toHaveBeenCalled();
});

// Decir QUE desaparece no es cortesia: es lo que hace que el consentimiento sea
// informado. Un "¿estás seguro?" a secas no lo es.
test('la confirmacion enumera lo que se pierde y avisa que no hay vuelta atras', async () => {
  const [titulo, cuerpo] = await abrirDialogo();
  expect(titulo).toBe('Eliminar mi cuenta');
  for (const cosa of ['perfil', 'publicaciones', 'fotos', 'mensajes']) {
    expect(cuerpo).toContain(cosa);
  }
  expect(cuerpo).toMatch(/no se puede deshacer/i);
});

test('ofrece cancelar, y cancelar no borra nada', async () => {
  const botones = (await abrirDialogo())[2];
  const cancelar = botones.find((b: { style?: string }) => b.style === 'cancel');
  expect(cancelar).toBeTruthy();
  cancelar.onPress?.();
  expect(mockEliminarMiCuenta).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

test('confirmar borra y lleva al login', async () => {
  mockEliminarMiCuenta.mockResolvedValue(undefined);
  const botones = (await abrirDialogo())[2];
  const eliminar = botones.find((b: { style?: string }) => b.style === 'destructive');
  await eliminar.onPress();
  await waitFor(() => expect(mockEliminarMiCuenta).toHaveBeenCalled());
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
});

// LA prueba que importa. Entre el 16 y el 19 de septiembre esta llamada fallaba
// de verdad en produccion. Si la pantalla navegara igual al login, la persona
// se iria creyendo que ejercio su derecho de cancelacion sin haberlo ejercido.
test('si el borrado falla NO se navega al login y se dice el motivo', async () => {
  mockEliminarMiCuenta.mockRejectedValue(new Error('Edge Function returned a non-2xx status code'));
  const botones = (await abrirDialogo())[2];
  const eliminar = botones.find((b: { style?: string }) => b.style === 'destructive');
  await eliminar.onPress();
  await waitFor(() => expect((Alert.alert as jest.Mock).mock.calls.length).toBeGreaterThan(1));
  expect(mockReplace).not.toHaveBeenCalled();
  const [tituloFallo, cuerpoFallo] = (Alert.alert as jest.Mock).mock.calls[1];
  expect(tituloFallo).toMatch(/No se pudo eliminar/i);
  expect(cuerpoFallo).toContain('non-2xx');
});

// ── Lo nuevo de esta pantalla ────────────────────────────────────────────────

test('«Sugerencias con IA» dice el estado real y lleva a las preferencias', async () => {
  await pintar();
  expect(screen.getByText('Activadas')).toBeTruthy();
  await pulsar('Sugerencias con IA');
  expect(mockPush).toHaveBeenCalledWith('/perfil/preferencias');
});

test('sin consentimiento de IA dice «Desactivadas»', async () => {
  almacen.consiente = false;
  await pintar();
  expect(screen.getByText('Desactivadas')).toBeTruthy();
  expect(screen.queryByText('Activadas')).toBeNull();
});

test('Configuración monta «Mi plan»', async () => {
  await pintar();
  expect(screen.getByText('GRUPO MI PLAN')).toBeTruthy();
});
