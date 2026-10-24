import { act, fireEvent, render, screen } from '@testing-library/react-native';

// El perfil (0083) se elige por perfil activo: un vendedor ve el suyo; un estudiante, el de siempre pero MÁS CORTO. Lo que se fija aquí es el del
// estudiante: la tarjeta con su etiqueta de correo, un resumen de «Mi búsqueda» (ya no los siete campos), una lista que lleva a donde dice, y el acceso a
// crear su perfil de vendedor (que reemplaza al viejo «Tus funciones» con alertas). La foto y la biografía viven ahora en la tarjeta y en «Sobre mí».

const mockPush = jest.fn();
const mockSetModulo = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn() } }));
jest.mock('@/store/useModuloStore', () => ({ useModuloStore: { getState: () => ({ setModulo: mockSetModulo }) } }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
const almacen: { perfil: Record<string, unknown> | null; cargando: boolean } = { perfil: null, cargando: false };
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({ perfil: almacen.perfil, cargando: almacen.cargando, cargarPerfil: jest.fn(), actualizarPerfil: jest.fn() }),
}));
jest.mock('@/components/perfil/TarjetaIdentidad', () => ({
  TarjetaIdentidad: ({ insignia }: { insignia?: string }) => {
    const { Text } = require('react-native');
    return <Text>{insignia ? `INSIGNIA:${insignia}` : 'SIN-INSIGNIA'}</Text>;
  },
}));
jest.mock('@/components/perfil/PerfilVendedor', () => ({
  PerfilVendedor: () => { const { Text } = require('react-native'); return <Text>VISTA-VENDEDOR</Text>; },
}));
const mockRoomie = jest.fn();
const mockPublicaciones = jest.fn();
jest.mock('@/hooks/queries/useRoomies', () => ({ useMiRoomie: (...a: unknown[]) => mockRoomie(...a) }));
jest.mock('@/hooks/queries/usePublicaciones', () => ({ useMisPublicaciones: (...a: unknown[]) => mockPublicaciones(...a) }));
const { usePerfilActivo } = jest.requireMock('@/hooks/queries/usePerfilActivo');

import PerfilScreen from '../perfil';

const PERFIL = {
  id: 'u1', nombre_usuario: 'yo', nombre_completo: 'Yo Prueba', biografia: '', universidad: 'UTVT',
  presupuesto_min: 2000, presupuesto_max: 4000, distancia_max_km: 10, correo_verificado: true,
};
const pulsar = async (e: string | RegExp) => { await act(async () => { fireEvent.press(screen.getByLabelText(e)); }); };

beforeEach(() => {
  jest.clearAllMocks();
  almacen.perfil = { ...PERFIL };
  almacen.cargando = false;
  mockRoomie.mockReturnValue({ miRoomie: null });
  mockPublicaciones.mockReturnValue({ datos: [], cargando: false });
  usePerfilActivo.mockReturnValue({ perfil: 'estudiante', cargando: false, fallo: false, cambiar: jest.fn(), cambiando: false });
});

describe('qué perfil se pinta', () => {
  it('un vendedor ve el perfil de vendedor', async () => {
    usePerfilActivo.mockReturnValue({ perfil: 'vendedor', cargando: false, fallo: false, cambiar: jest.fn(), cambiando: false });
    await render(<PerfilScreen />);
    expect(screen.getByText('VISTA-VENDEDOR')).toBeTruthy();
    expect(screen.queryByText('MI BÚSQUEDA')).toBeNull();
  });

  it('un estudiante, y mientras no se sabe el perfil, ven el de estudiante', async () => {
    await render(<PerfilScreen />);
    expect(screen.getByText('MI BÚSQUEDA')).toBeTruthy();
    expect(screen.queryByText('VISTA-VENDEDOR')).toBeNull();

    usePerfilActivo.mockReturnValue({ perfil: null, cargando: true, fallo: false, cambiar: jest.fn(), cambiando: false });
    await render(<PerfilScreen />);
    expect(screen.queryByText('VISTA-VENDEDOR')).toBeNull();
  });
});

describe('la cabecera y la tarjeta', () => {
  it('el engranaje abre Configuración', async () => {
    await render(<PerfilScreen />);
    await pulsar('Configuración');
    expect(mockPush).toHaveBeenCalledWith('/configuracion');
  });

  it('con el correo verificado la tarjeta lo dice, y SIN verificar no lo afirma', async () => {
    await render(<PerfilScreen />);
    expect(screen.getByText('INSIGNIA:Correo verificado')).toBeTruthy();
  });

  it('un correo sin verificar no lleva la etiqueta', async () => {
    almacen.perfil = { ...PERFIL, correo_verificado: false };
    await render(<PerfilScreen />);
    expect(screen.getByText('SIN-INSIGNIA')).toBeTruthy();
  });
});

describe('«Mi búsqueda»', () => {
  it('resume presupuesto, distancia y universidad', async () => {
    await render(<PerfilScreen />);
    expect(screen.getByText('$2,000 a $4,000')).toBeTruthy();
    expect(screen.getByText('Hasta 10 km')).toBeTruthy();
    expect(screen.getByText('UTVT')).toBeTruthy();
  });

  it('cada dato lleva su etiqueta: la universidad no se repite como «Universidad Universidad…»', async () => {
    await render(<PerfilScreen />);
    expect(screen.getByText('Presupuesto al mes')).toBeTruthy();
    expect(screen.getByText('Distancia máxima')).toBeTruthy();
    expect(screen.getByText('Estudio en')).toBeTruthy();
    expect(screen.queryByText('Universidad')).toBeNull();
  });

  it('un perfil sin llenar dice «sin definir» en vez de quedarse en blanco', async () => {
    almacen.perfil = { ...PERFIL, presupuesto_min: null, presupuesto_max: null, distancia_max_km: null, universidad: null };
    await render(<PerfilScreen />);
    expect(screen.getAllByText('sin definir')).toHaveLength(3);
  });

  it('«Editar» abre las preferencias', async () => {
    await render(<PerfilScreen />);
    await pulsar('Editar mi búsqueda');
    expect(mockPush).toHaveBeenCalledWith('/perfil/preferencias');
  });

  it('ya NO pinta los siete campos de la ficha vieja', async () => {
    await render(<PerfilScreen />);
    expect(screen.queryByText('TU FICHA DE BÚSQUEDA')).toBeNull();
    expect(screen.queryByText('Nivel de ruido')).toBeNull();
    expect(screen.queryByText('Mascotas')).toBeNull();
  });
});

describe('los renglones llevan a donde dicen', () => {
  it('«Mis datos» abre las preferencias', async () => {
    await render(<PerfilScreen />);
    await pulsar(/^Mis datos/);
    expect(mockPush).toHaveBeenCalledWith('/perfil/preferencias');
  });

  it('«Sobre mí» abre su pantalla, y dice lo que ya escribiste', async () => {
    almacen.perfil = { ...PERFIL, biografia: 'Estudio mecatrónica y tengo un gato.' };
    await render(<PerfilScreen />);
    expect(screen.getByLabelText(/^Sobre mí\. Estudio mecatrónica/)).toBeTruthy();
    await pulsar(/^Sobre mí/);
    expect(mockPush).toHaveBeenCalledWith('/perfil/sobre-mi');
  });

  it('«Sobre mí» sin texto invita a escribirlo', async () => {
    await render(<PerfilScreen />);
    expect(screen.getByLabelText(/^Sobre mí\. Todavía no has escrito/)).toBeTruthy();
  });

  it('«Cómo me ven» abre la ficha propia con el id propio', async () => {
    await render(<PerfilScreen />);
    await pulsar(/^Cómo me ven/);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/perfil/[usuarioId]', params: { usuarioId: 'u1' } });
  });

  it('«Mi ficha de roomie» elige el módulo Roomies y va a Inicio', async () => {
    await render(<PerfilScreen />);
    await pulsar(/^Mi ficha de roomie/);
    expect(mockSetModulo).toHaveBeenCalledWith('roomies');
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/inicio');
  });
});

describe('el estado que muestran es el real', () => {
  it('un roomie activo se anuncia activo', async () => {
    mockRoomie.mockReturnValue({ miRoomie: { estado: 'activo' } });
    await render(<PerfilScreen />);
    expect(screen.getByLabelText(/^Mi ficha de roomie\. Activa/)).toBeTruthy();
  });

  it('un roomie pausado NO se anuncia como activo', async () => {
    mockRoomie.mockReturnValue({ miRoomie: { estado: 'pausado' } });
    await render(<PerfilScreen />);
    expect(screen.getByLabelText(/^Mi ficha de roomie\. Pausada/)).toBeTruthy();
    expect(screen.queryByLabelText(/Activa/)).toBeNull();
  });

  it('sin ficha de roomie dice que nadie te encuentra', async () => {
    await render(<PerfilScreen />);
    expect(screen.getByLabelText(/^Mi ficha de roomie\. Sin crear/)).toBeTruthy();
  });
});

describe('«Mis publicaciones»', () => {
  it('sin publicaciones no hay renglón: un estudiante no lo necesita', async () => {
    await render(<PerfilScreen />);
    expect(screen.queryByLabelText(/^Mis publicaciones/)).toBeNull();
  });

  it('con publicaciones distingue publicadas de activas y lleva a la pestaña', async () => {
    mockPublicaciones.mockReturnValue({ datos: [{ id: 'a', activa: true }, { id: 'b', activa: false }, { id: 'c', activa: true }], cargando: false });
    await render(<PerfilScreen />);
    expect(screen.getByLabelText(/^Mis publicaciones\. 3 publicadas · 2 activas/)).toBeTruthy();
    await pulsar(/^Mis publicaciones/);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/publicar');
  });

  it('dice el singular cuando es una sola', async () => {
    mockPublicaciones.mockReturnValue({ datos: [{ id: 'a', activa: true }], cargando: false });
    await render(<PerfilScreen />);
    expect(screen.getByLabelText(/1 publicada · 1 activa$/)).toBeTruthy();
  });
});

describe('el acceso a ser vendedor', () => {
  it('lleva a crear el perfil de vendedor', async () => {
    await render(<PerfilScreen />);
    await pulsar(/^Crea tu perfil de vendedor/);
    expect(mockPush).toHaveBeenCalledWith('/perfil/crear-vendedor');
  });

  it('ya NO hay «Tus funciones» con alertas', async () => {
    await render(<PerfilScreen />);
    expect(screen.queryByText('Tus funciones')).toBeNull();
  });
});

describe('cargando', () => {
  it('mientras carga pinta el esqueleto y no la ficha vacía', async () => {
    almacen.cargando = true;
    await render(<PerfilScreen />);
    expect(screen.queryByText('MI BÚSQUEDA')).toBeNull();
    expect(screen.queryByLabelText(/^Mis datos/)).toBeNull();
  });
});
