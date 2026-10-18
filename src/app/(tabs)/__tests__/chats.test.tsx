import { render, screen } from '@testing-library/react-native';

// V.8 · `chats.tsx`, la lista de conversaciones.
//
// La suscripción de Realtime NO se prueba aquí: se mudó a `useConversaciones`
// con END-18 y tiene su propio archivo (`hooks/queries/__tests__/useChat`), más
// las pruebas del canal en el servicio. Una prueba de la fuga puesta en esta
// pantalla habría comprobado el mock del hook y habría pasado en verde con la
// fuga intacta. Queda dicho porque la cola de trabajo pedía ponerla aquí.
//
// Lo que sí es de la pantalla: la insignia de no leídos, que es la única cifra
// del producto que el usuario mira sin tocar nada, y el renglón cuando falta la
// foto o el último mensaje.

const mockConversaciones = jest.fn();

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/hooks/queries/useChat', () => ({
  useConversaciones: (...a: unknown[]) => mockConversaciones(...a),
}));
// Devuelve la URL firmada resuelta: §14 deja el bucket privado, así que una ruta
// cruda no carga y el avatar SOLO aparece si se firmó. Con un Map vacío se
// pintaba siempre la inicial y la mitad con foto no se ejecutaba nunca.
jest.mock('@/hooks/use-fotos-firmadas', () => ({
  useFotosFirmadas: (rutas: (string | null | undefined)[]) => ({
    urls: new Map(rutas.filter(Boolean).map((r) => [r, `https://firmada.test/${r}`])),
    fallo: null,
  }),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));

import ChatsScreen from '../chats';

const hilo = (extra: Record<string, unknown> = {}) => ({
  conversacionId: 'c1',
  otroUsuario: { id: 'o1', nombre_completo: 'Ana Pérez', foto_url: null },
  ultimoMensaje: { contenido: '¿Sigue disponible el cuarto?', creado_en: '2026-09-26T12:00:00Z' },
  noLeidos: 0,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockConversaciones.mockReturnValue({ conversaciones: [hilo()], cargando: false });
});

test('sin no leídos no se pinta insignia', async () => {
  await render(<ChatsScreen />);
  expect(screen.getByText('Ana Pérez')).toBeTruthy();
  expect(screen.queryByText('0')).toBeNull();
});

test('con no leídos aparece la cifra', async () => {
  mockConversaciones.mockReturnValue({ conversaciones: [hilo({ noLeidos: 4 })], cargando: false });
  await render(<ChatsScreen />);
  expect(screen.getByText('4')).toBeTruthy();
});

// El tope. Sin él, un 1247 rompería el ancho del renglón y empujaría el nombre
// fuera de la fila — y esa cifra no aporta nada sobre «muchos».
test('a partir de cien la insignia dice 99+', async () => {
  mockConversaciones.mockReturnValue({ conversaciones: [hilo({ noLeidos: 1247 })], cargando: false });
  await render(<ChatsScreen />);
  expect(screen.getByText('99+')).toBeTruthy();
  expect(screen.queryByText('1247')).toBeNull();
});

// El 99 exacto NO se recorta: el tope es «más de 99», no «99 o más».
test('noventa y nueve se muestra entero', async () => {
  mockConversaciones.mockReturnValue({ conversaciones: [hilo({ noLeidos: 99 })], cargando: false });
  await render(<ChatsScreen />);
  expect(screen.getByText('99')).toBeTruthy();
});

// Lo que hace que esto sea usable sin ver colores: el número de sin leer va en
// la etiqueta, no solo en la insignia. Un lector de pantalla leyendo «Ana Pérez,
// ¿sigue disponible el cuarto?» no distingue un hilo leído de uno que no.
test('la etiqueta dice cuántos hay sin leer', async () => {
  mockConversaciones.mockReturnValue({ conversaciones: [hilo({ noLeidos: 4 })], cargando: false });
  await render(<ChatsScreen />);
  const fila = screen.getByLabelText(/Conversación con Ana Pérez/);
  expect(fila.props.accessibilityLabel).toContain('4 sin leer');
});

test('y no lo dice cuando no hay ninguno', async () => {
  await render(<ChatsScreen />);
  const fila = screen.getByLabelText(/Conversación con Ana Pérez/);
  expect(fila.props.accessibilityLabel).not.toContain('sin leer');
  expect(fila.props.accessibilityLabel).toContain('¿Sigue disponible el cuarto?');
});

// Sin foto, la inicial. Un círculo gris vacío no distingue una conversación de
// otra; una letra sí. El bucket es privado (§14), así que la foto falta a menudo
// —mientras la URL firmada no ha llegado— y este es el estado normal, no el raro.
test('sin foto se pinta la inicial en mayúscula', async () => {
  mockConversaciones.mockReturnValue({
    conversaciones: [hilo({ otroUsuario: { id: 'o1', nombre_completo: 'ana pérez', foto_url: null } })],
    cargando: false,
  });
  await render(<ChatsScreen />);
  expect(screen.getByText('A')).toBeTruthy();
});

// Un nombre ausente no debe pintar un renglón con un hueco ni reventar al leer
// `charAt(0)` de undefined.
test('sin nombre la inicial es una interrogación, no un fallo', async () => {
  mockConversaciones.mockReturnValue({
    conversaciones: [hilo({ otroUsuario: { id: 'o1', nombre_completo: null, foto_url: null } })],
    cargando: false,
  });
  await render(<ChatsScreen />);
  expect(screen.getByText('?')).toBeTruthy();
});

// Una conversación recién abierta desde «ver contacto» no tiene mensajes. Sin
// este texto el renglón se lee como un hilo roto.
test('una conversación sin mensajes lo dice', async () => {
  mockConversaciones.mockReturnValue({
    conversaciones: [hilo({ ultimoMensaje: null })],
    cargando: false,
  });
  await render(<ChatsScreen />);
  expect(screen.getByText('Sin mensajes todavía')).toBeTruthy();
});

test('sin conversaciones lo dice en vez de dejar la lista muda', async () => {
  mockConversaciones.mockReturnValue({ conversaciones: [], cargando: false });
  await render(<ChatsScreen />);
  expect(screen.getByText('Sin conversaciones')).toBeTruthy();
  expect(screen.queryByText('0 CONVERSACIONES')).toBeNull();
});

// §27 · Vacío y cargando son estados distintos.
test('mientras carga no afirma que no hay ninguna', async () => {
  mockConversaciones.mockReturnValue({ conversaciones: [], cargando: true });
  await render(<ChatsScreen />);
  expect(screen.queryByText('Sin conversaciones')).toBeNull();
});

test('el conteo del membrete concuerda en número', async () => {
  await render(<ChatsScreen />);
  expect(screen.queryByText('1 CONVERSACIÓN')).toBeNull();

  mockConversaciones.mockReturnValue({ conversaciones: [hilo(), hilo({ conversacionId: 'c2' })], cargando: false });
  await render(<ChatsScreen />);
  expect(screen.queryByText('2 CONVERSACIONES')).toBeNull();
});


// El avatar con foto: la otra mitad de la inicial. Si la URL firmada llega, se
// pinta la imagen y la letra desaparece — si se pintaran las dos, el renglón
// tendría una letra encima de la cara.
test('con foto firmada se pinta la imagen y no la inicial', async () => {
  mockConversaciones.mockReturnValue({
    conversaciones: [hilo({ otroUsuario: { id: 'o1', nombre_completo: 'Ana Pérez', foto_url: 'o1/avatar.jpg' } })],
    cargando: false,
  });
  await render(<ChatsScreen />);
  expect(screen.queryByText('A')).toBeNull();
  expect(screen.getByText('Ana Pérez')).toBeTruthy();
});
