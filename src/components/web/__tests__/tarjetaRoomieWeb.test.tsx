import { fireEvent, render, screen } from '@testing-library/react-native';

// La tarjeta de una persona que busca roomie. La etiqueta de compatibilidad sale de las REGLAS (la que se puede explicar con las frases de abajo); sin dato dice «sin datos para comparar», NO «baja» (no tener con qué
// comparar no es ser incompatible). Lo que coincide y lo que difiere son las frases reales del servidor. «Saludar» abre el chat salvo en una cuenta restringida.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const mockAbrirChat = jest.fn();
jest.mock('@/lib/abrirChat', () => ({ abrirChatCon: (...a: unknown[]) => mockAbrirChat(...a) }));
const mockRestringida = { valor: false };
jest.mock('@/hooks/queries/useCuentaRestringida', () => ({ useCuentaRestringida: () => mockRestringida.valor }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'yo' } } }) }));

import { TarjetaRoomieWeb } from '../TarjetaRoomieWeb';
import type { RoomieSugerido } from '@/types/database.types';

const R = (extra: Partial<RoomieSugerido> = {}) =>
  ({ id: 'r1', usuario_id: 'u2', descripcion_busqueda: 'Busco roomie para depa de 2 cuartos.', presupuesto_aportacion: null, estado: 'activo', creado_en: 'x', nombre_completo: 'Valeria Soto', foto_url: null, biografia: null, similitud: 0.8, compatibilidad: 0.9, coincidencias: ['Mismo nivel de ruido', 'Ambos fuman'], diferencias: ['Uno tiene mascotas y el otro no'], ...extra }) as RoomieSugerido;

beforeEach(() => {
  jest.clearAllMocks();
  mockRestringida.valor = false;
});

describe('TarjetaRoomieWeb', () => {
  it('nombre, qué busca, compatibilidad en palabras y las frases reales', async () => {
    await render(<TarjetaRoomieWeb r={R()} />);
    expect(screen.getByText('Valeria Soto')).toBeTruthy();
    expect(screen.getByText('Busco roomie para depa de 2 cuartos.')).toBeTruthy();
    expect(screen.getByText('Compatibilidad alta')).toBeTruthy();
    expect(screen.getByText('Mismo nivel de ruido')).toBeTruthy();
    expect(screen.getByText('Uno tiene mascotas y el otro no')).toBeTruthy();
  });

  it('los cortes de la etiqueta son los de la app: media entre 0.5 y 0.75, baja por debajo', async () => {
    const { unmount } = await render(<TarjetaRoomieWeb r={R({ compatibilidad: 0.6 })} />);
    expect(screen.getByText('Compatibilidad media')).toBeTruthy();
    await unmount();
    await render(<TarjetaRoomieWeb r={R({ compatibilidad: 0.3 })} />);
    expect(screen.getByText('Compatibilidad baja')).toBeTruthy();
  });

  it('sin dato de compatibilidad dice «Sin datos para comparar», nunca «baja»', async () => {
    await render(<TarjetaRoomieWeb r={R({ compatibilidad: null, coincidencias: [], diferencias: [] })} />);
    expect(screen.getByText('Sin datos para comparar')).toBeTruthy();
    expect(screen.queryByText(/baja/i)).toBeNull();
  });

  it('sin foto, la inicial', async () => {
    await render(<TarjetaRoomieWeb r={R()} />);
    expect(screen.getByText('V')).toBeTruthy();
  });

  it('«Saludar» abre el chat con esa persona y «Ver perfil» lleva a su perfil', async () => {
    await render(<TarjetaRoomieWeb r={R()} />);
    await fireEvent.press(screen.getByLabelText('Saludar a Valeria Soto'));
    expect(mockAbrirChat).toHaveBeenCalledWith('u2');
    await fireEvent.press(screen.getByLabelText('Ver perfil de Valeria Soto'));
    expect(mockPush).toHaveBeenCalledWith('/perfil/u2');
  });

  it('una cuenta restringida no abre conversaciones nuevas: no se ofrece «Saludar»', async () => {
    mockRestringida.valor = true;
    await render(<TarjetaRoomieWeb r={R()} />);
    expect(screen.queryByLabelText('Saludar a Valeria Soto')).toBeNull();
    expect(screen.getByLabelText('Ver perfil de Valeria Soto')).toBeTruthy();
  });

  it('la versión compacta no pinta las frases largas (cabe en una fila de tres)', async () => {
    await render(<TarjetaRoomieWeb r={R()} compacta />);
    expect(screen.getByText('Valeria Soto')).toBeTruthy();
    expect(screen.getByText('Compatibilidad alta')).toBeTruthy();
    expect(screen.queryByLabelText('Saludar a Valeria Soto')).toBeNull();
  });
});
