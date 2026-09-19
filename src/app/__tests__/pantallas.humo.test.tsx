import { render, screen, waitFor } from '@testing-library/react-native';

// Pruebas de humo de las pantallas rediseñadas.
//
// No comprueban que se vean bien —eso solo se ve en un dispositivo—. Comprueban
// que MONTAN y pintan su contenido, que es el fallo que mas caro sale: una
// pantalla que revienta al abrirse no tiene arreglo en vivo.
//
// El precedente que las justifica: un `useImperativeHandle` colocado antes de
// declarar `handleSubmit` lo leia en su zona muerta temporal y tumbaba el
// formulario al montar. No lo atraparon ni tsc ni jest —solo `expo lint`, y de
// casualidad—, porque ninguna prueba montaba nada.
//
// Tambien cubren el estado VACIO de cada lista, que es como las vera el
// profesor si abre una pestaña sin datos: una lista vacia sin texto se lee como
// una pantalla rota.

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: (...a: unknown[]) => mockPush(...a), replace: (...a: unknown[]) => mockReplace(...a), back: jest.fn() },
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
    useLocalSearchParams: () => ({ usuarioId: 'otro1', id: 'pub1' }),
    // Varias pestañas recargan al enfocarse. Fuera de un navegador nunca hay
    // foco, asi que se ejecuta una vez al montar: es lo que ocurre de verdad la
    // primera vez que se abre la pestaña.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, []),
    Link: ({ children }: { children: React.ReactNode }) => children,
    Stack: { Screen: () => null },
  };
});
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({}) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ session: { user: { id: 'u1', email: 'yo@ejemplo.mx' } }, cerrarSesion: jest.fn() }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({ perfil: { id: 'u1', consiente_analisis_ia: true }, cargando: false, cargarPerfil: jest.fn(), actualizarPerfil: jest.fn() }),
}));
jest.mock('@/services/roomies.service', () => ({
  listarRoomiesSugeridos: jest.fn().mockResolvedValue([]),
  obtenerMiRoomie: jest.fn().mockResolvedValue(null),
  guardarMiRoomie: jest.fn(),
}));
jest.mock('@/services/publicaciones.service', () => ({
  listarMisPublicaciones: jest.fn().mockResolvedValue([]),
  contarContactosRecibidos: jest.fn().mockResolvedValue(new Map()),
  cambiarEstadoPublicacion: jest.fn(),
  obtenerPublicacionPublica: jest.fn().mockResolvedValue(null),
  revelarContacto: jest.fn(),
  reportarPublicacion: jest.fn(),
  reintentarGeocodingPendiente: jest.fn().mockResolvedValue(0),
}));
jest.mock('@/services/mensajes.service', () => ({
  listarConversaciones: jest.fn().mockResolvedValue([]),
  abrirConversacion: jest.fn(),
  suscribirseAMisChats: jest.fn(() => () => {}),
  suscribirseAConversacion: jest.fn(() => () => {}),
  marcarConversacionComoLeida: jest.fn(),
  listarMensajes: jest.fn().mockResolvedValue([]),
  enviarMensaje: jest.fn(),
}));
jest.mock('@/services/usuarios.service', () => ({
  obtenerPerfilPublico: jest.fn().mockResolvedValue(null),
  reportarUsuario: jest.fn(),
  eliminarMiCuenta: jest.fn(),
  exportarMisDatos: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }) } } }));

// Cada pestaña se comprueba por su encabezado, no por `toJSON()` a secas: una
// pantalla puede "montar" devolviendo null y eso pasaria igual, que es
// exactamente la clase de verde enganoso que hoy costo tres bugs.
test('Roomies monta con lista vacia y muestra su encabezado', async () => {
  const Pantalla = require('../(tabs)/roomies').default;
  await render(<Pantalla />);
  await waitFor(() => expect(screen.getByText('Roomies')).toBeTruthy());
  expect(screen.getByText('REGISTRO DE ROOMIES')).toBeTruthy();
});

test('Mis publicaciones monta con lista vacia y muestra su encabezado', async () => {
  const Pantalla = require('../(tabs)/publicaciones').default;
  await render(<Pantalla />);
  await waitFor(() => expect(screen.getByText('Mis publicaciones')).toBeTruthy());
  expect(screen.getByText('REGISTRO PROPIO')).toBeTruthy();
});

test('Chats monta con lista vacia y muestra su encabezado', async () => {
  const Pantalla = require('../(tabs)/chats').default;
  await render(<Pantalla />);
  await waitFor(() => expect(screen.getByText('Chats')).toBeTruthy());
  expect(screen.getByText('REGISTRO DE MENSAJES')).toBeTruthy();
});

test('Recuperar contraseña monta con su campo de correo', async () => {
  const Pantalla = require('../(auth)/recuperar-contrasena').default;
  await render(<Pantalla />);
  await waitFor(() => expect(screen.getByPlaceholderText('tucorreo@ejemplo.mx')).toBeTruthy());
  expect(screen.getByLabelText('Enviar enlace')).toBeTruthy();
});

// Esta es la unica del grupo que puede comprobar CONTENIDO real sin inventarse
// datos: el aviso se genera de src/lib/avisoPrivacidad.ts, que ya tiene sus
// propias pruebas de que no se desvia del documento.
test('El aviso de privacidad monta y muestra sus secciones', async () => {
  const Pantalla = require('../aviso-privacidad').default;
  await render(<Pantalla />);
  await waitFor(() => expect(screen.getByText(/Derechos ARCO/i)).toBeTruthy());
});

test('El perfil publico monta aunque no encuentre a la persona', async () => {
  const Pantalla = require('../perfil/[usuarioId]').default;
  await render(<Pantalla />);
  await waitFor(() => expect(screen.toJSON()).toBeTruthy());
});
