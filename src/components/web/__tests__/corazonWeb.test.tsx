import { fireEvent, render, screen } from '@testing-library/react-native';

// El corazón de las tarjetas de la web. Sin sesión, pide entrar (sin cuenta no se guarda nada); con sesión, guarda o quita de verdad, para una vivienda o para un negocio. Mientras no se sabe qué hay guardado
// no responde (tocar sin saber el estado guardaría lo que ya estaba), y si el servidor falla lo dice.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockToast(...a) } }));

const mockSesion = { valor: null as null | { user: { id: string } } };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: { session: unknown }) => unknown) => sel({ session: mockSesion.valor }) }));

const mockGuardadas = { ids: new Set<string>(), cargando: false };
const mockAlternar = jest.fn();
jest.mock('@/hooks/queries/useFavoritos', () => ({
  useMisFavoritosIds: () => mockGuardadas,
  useAlternarFavorito: () => ({ mutate: (...a: unknown[]) => mockAlternar('pub', ...a) }),
}));
jest.mock('@/hooks/queries/useFavoritosNegocios', () => ({
  useMisNegociosFavoritosIds: () => mockGuardadas,
  useAlternarFavoritoNegocio: () => ({ mutate: (...a: unknown[]) => mockAlternar('neg', ...a) }),
}));

import { CorazonWeb } from '../CorazonWeb';

beforeEach(() => {
  jest.clearAllMocks();
  mockSesion.valor = null;
  mockGuardadas.ids = new Set();
  mockGuardadas.cargando = false;
});

describe('CorazonWeb', () => {
  it('sin sesión lleva a entrar', async () => {
    await render(<CorazonWeb tipo="publicacion" id="p1" />);
    await fireEvent.press(screen.getByLabelText('Guardar: inicia sesión para guardar'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
    expect(mockAlternar).not.toHaveBeenCalled();
  });

  it('con sesión guarda una vivienda, y lo dice con su etiqueta', async () => {
    mockSesion.valor = { user: { id: 'u1' } };
    await render(<CorazonWeb tipo="publicacion" id="p1" />);
    await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
    expect(mockAlternar).toHaveBeenCalledWith('pub', { publicacionId: 'p1', guardar: true }, expect.any(Object));
  });

  it('si ya estaba guardada la quita', async () => {
    mockSesion.valor = { user: { id: 'u1' } };
    mockGuardadas.ids = new Set(['p1']);
    await render(<CorazonWeb tipo="publicacion" id="p1" />);
    await fireEvent.press(screen.getByLabelText('Quitar de favoritos'));
    expect(mockAlternar).toHaveBeenCalledWith('pub', { publicacionId: 'p1', guardar: false }, expect.any(Object));
  });

  it('un negocio usa los favoritos de negocios', async () => {
    mockSesion.valor = { user: { id: 'u1' } };
    await render(<CorazonWeb tipo="negocio" id="n1" />);
    await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
    expect(mockAlternar).toHaveBeenCalledWith('neg', { negocioId: 'n1', guardar: true }, expect.any(Object));
  });

  it('mientras no se sabe qué hay guardado no responde', async () => {
    mockSesion.valor = { user: { id: 'u1' } };
    mockGuardadas.cargando = true;
    await render(<CorazonWeb tipo="publicacion" id="p1" />);
    await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
    expect(mockAlternar).not.toHaveBeenCalled();
  });

  it('si el servidor falla, avisa (y no dice que se guardó)', async () => {
    mockSesion.valor = { user: { id: 'u1' } };
    await render(<CorazonWeb tipo="publicacion" id="p1" />);
    await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
    const opciones = mockAlternar.mock.calls[0][2] as { onError: (e: unknown) => void };
    opciones.onError(new Error('red'));
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('No pudimos actualizar tus favoritos'));
  });

  // El salto es respuesta a un gesto: una tarjeta que YA estaba guardada al cargar no debe saltar.
  it('no salta al cargar una tarjeta que ya estaba guardada', async () => {
    mockSesion.valor = { user: { id: 'u1' } };
    mockGuardadas.ids = new Set(['p1']);
    await render(<CorazonWeb tipo="publicacion" id="p1" />);
    expect(screen.getByTestId('corazon-icono').props.dataSet).toBeUndefined();
  });

  it('salta cuando la persona guarda, y no al quitar', async () => {
    mockSesion.valor = { user: { id: 'u1' } };
    const { rerender } = await render(<CorazonWeb tipo="publicacion" id="p1" />);
    await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
    mockGuardadas.ids = new Set(['p1']);
    await rerender(<CorazonWeb tipo="publicacion" id="p1" />);
    expect(screen.getByTestId('corazon-icono').props.dataSet).toEqual({ anim: 'pop' });
    // Quitar: ya no salta.
    await fireEvent.press(screen.getByLabelText('Quitar de favoritos'));
    mockGuardadas.ids = new Set();
    await rerender(<CorazonWeb tipo="publicacion" id="p1" />);
    expect(screen.getByTestId('corazon-icono').props.dataSet).toBeUndefined();
  });
});
