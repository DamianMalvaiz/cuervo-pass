import { fireEvent, render, screen } from '@testing-library/react-native';

// La bandeja de chats de la web. En escritorio: la lista a la izquierda y la conversación a la derecha, sin salir de la página. En teléfono: la lista, y tocar una abre la pantalla de la conversación. Cuatro estados
// distintos (invariante 2): cargando, FALLÓ la lectura (nunca «sin conversaciones»), vacío y lista.

const mockPush = jest.fn();
const mockParams: { c?: string } = {};
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) }, useLocalSearchParams: () => mockParams }));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
const mockPantalla = { ancho: 1440 };
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: mockPantalla.ancho, alto: 900, clase: 'amplia' }) }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }) }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map(), fallo: null }) }));
jest.mock('../PieWeb', () => ({ PieWeb: () => null }));
jest.mock('@/components/ConversacionHilo', () => ({ ConversacionHilo: ({ conversacionId }: { conversacionId: string }) => require('react').createElement(require('react-native').Text, null, `HILO ${conversacionId}`) }));

const reintentar = jest.fn();
const mockChats = {
  conversaciones: [] as unknown[],
  cargando: false,
  fallo: false,
  reintentar,
};
jest.mock('@/hooks/queries/useChat', () => ({ useConversaciones: () => mockChats }));

import { ChatsWeb } from '../ChatsWeb';

const conv = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  conversacionId: id,
  otroUsuario: { nombre_completo: nombre, foto_url: null },
  ultimoMensaje: { contenido: `Hola de ${nombre}`, creado_en: '2026-10-26T15:00:00Z' },
  noLeidos: 0,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPantalla.ancho = 1440;
  delete mockParams.c;
  Object.assign(mockChats, { conversaciones: [], cargando: false, fallo: false });
});

describe('ChatsWeb', () => {
  it('en escritorio enseña la lista y, sin elegir, invita a elegir una conversación', async () => {
    mockChats.conversaciones = [conv('c1', 'Ana Ruiz'), conv('c2', 'Luis Pérez')];
    await render(<ChatsWeb />);
    expect(screen.getByText('Ana Ruiz')).toBeTruthy();
    expect(screen.getByText('Luis Pérez')).toBeTruthy();
    expect(screen.getByText('Elige una conversación')).toBeTruthy();
    expect(screen.queryByText(/^HILO/)).toBeNull();
  });

  it('en escritorio tocar una conversación la abre a la derecha, sin navegar', async () => {
    mockChats.conversaciones = [conv('c1', 'Ana Ruiz'), conv('c2', 'Luis Pérez')];
    await render(<ChatsWeb />);
    await fireEvent.press(screen.getByLabelText(/Conversación con Luis Pérez/));
    expect(screen.getByText('HILO c2')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText('Elige una conversación')).toBeNull();
  });

  it('cambiar de conversación cambia el hilo', async () => {
    mockChats.conversaciones = [conv('c1', 'Ana Ruiz'), conv('c2', 'Luis Pérez')];
    await render(<ChatsWeb />);
    await fireEvent.press(screen.getByLabelText(/Conversación con Ana Ruiz/));
    await fireEvent.press(screen.getByLabelText(/Conversación con Luis Pérez/));
    expect(screen.getByText('HILO c2')).toBeTruthy();
    expect(screen.queryByText('HILO c1')).toBeNull();
  });

  it('en teléfono tocar una conversación abre su pantalla', async () => {
    mockPantalla.ancho = 390;
    mockChats.conversaciones = [conv('c1', 'Ana Ruiz')];
    await render(<ChatsWeb />);
    await fireEvent.press(screen.getByLabelText(/Conversación con Ana Ruiz/));
    expect(mockPush).toHaveBeenCalledWith('/chat/c1');
    expect(screen.queryByText(/^HILO/)).toBeNull();
  });

  it('los no leídos se anuncian en la etiqueta y se ven con su cifra', async () => {
    mockChats.conversaciones = [conv('c1', 'Ana Ruiz', { noLeidos: 3 })];
    await render(<ChatsWeb />);
    expect(screen.getByLabelText(/3 sin leer/)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('un FALLO al leer las conversaciones NO se pinta como «sin conversaciones»', async () => {
    mockChats.fallo = true;
    await render(<ChatsWeb />);
    expect(screen.getByText('No pudimos cargar tus conversaciones')).toBeTruthy();
    expect(screen.queryByText('Sin conversaciones')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(reintentar).toHaveBeenCalled();
  });

  it('sin conversaciones lo dice', async () => {
    await render(<ChatsWeb />);
    expect(screen.getByText('Sin conversaciones')).toBeTruthy();
  });

  it('mientras carga no afirma que no hay nada', async () => {
    mockChats.cargando = true;
    await render(<ChatsWeb />);
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
    expect(screen.queryByText('Sin conversaciones')).toBeNull();
  });

  it('si llega con una conversación elegida (recién abierta desde una ficha) la abre a la derecha, aunque la lista aún no la traiga', async () => {
    mockParams.c = 'nueva';
    mockChats.conversaciones = [conv('c1', 'Ana Ruiz')];
    await render(<ChatsWeb />);
    expect(screen.getByText('HILO nueva')).toBeTruthy();
    expect(screen.queryByText('Elige una conversación')).toBeNull();
  });
});
