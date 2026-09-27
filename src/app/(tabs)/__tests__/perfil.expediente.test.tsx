import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// La sección «TU EXPEDIENTE PÚBLICO».
//
// El hueco que cierra era real y silencioso: `perfil/[usuarioId]` existe desde
// la 0026, y NADA en la app enlazaba al propio. Se podía ver la ficha de
// cualquiera menos la de uno mismo — en un producto cuyo PRODUCT.md dice que la
// confianza para quien decide sin visitar pesa tanto como el matching, y que
// desde END-07 muestra en esa ficha si tu correo está verificado.
//
// Las tres primeras pruebas fijan que los renglones llevan A DONDE DICEN. Las
// dos últimas fijan que el estado que muestran es el REAL y no el que uno
// supondría: «publicada» y «activa» no son lo mismo, y tener ficha de roomie no
// es aparecer en la lista.

const mockPush = jest.fn();
// El prefijo `mock` no es estilo: jest prohibe que la fabrica de un
// jest.mock() referencie variables de fuera salvo que se llamen asi.
let mockRoomie: { estado: string } | null = { estado: 'activo' };
let mockPublicaciones: { activa: boolean }[] = [];

jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn() } }));
jest.mock('@/services/usuarios.service', () => ({ eliminarMiCuenta: jest.fn(), exportarMisDatos: jest.fn() }));
jest.mock('@/lib/storage', () => ({ subirFotoPerfil: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({}) }));
jest.mock('@/hooks/queries/useRoomies', () => ({ useMiRoomie: () => ({ miRoomie: mockRoomie }) }));
jest.mock('@/hooks/queries/usePublicaciones', () => ({
  useMisPublicaciones: () => ({ datos: mockPublicaciones, cargando: false }),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ session: { user: { id: 'u1', email: 'yo@ejemplo.mx' } }, cerrarSesion: jest.fn() }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({
    perfil: {
      id: 'u1', nombre_usuario: 'yo', nombre_completo: 'Yo Prueba', biografia: '',
      universidad: 'UTVT', presupuesto_min: 2000, presupuesto_max: 4000,
      distancia_max_km: 10, nivel_ruido: 'bajo', mascotas: false, fuma: false,
      consiente_analisis_ia: true, cuestionario_completo: true,
      foto_url: null, horario_predominante: 'mixto',
    },
    cargando: false,
    cargarPerfil: jest.fn(),
    actualizarPerfil: jest.fn(),
  }),
}));

import { QueryClientProvider } from '@tanstack/react-query';

import { clienteDePrueba } from '@pruebas/consultas';

import PerfilScreen from '../perfil';

const envolver = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={clienteDePrueba({ queries: { retry: false } })}>
    {children}
  </QueryClientProvider>
);

const montar = async () => {
  await render(<PerfilScreen />, { wrapper: envolver });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockRoomie = { estado: 'activo' };
  mockPublicaciones = [];
});

describe('los renglones llevan a donde dicen', () => {
  it('«Ver mi perfil público» abre la ficha propia, con el id propio', async () => {
    await montar();
    await act(async () => { fireEvent.press(screen.getByText('Ver mi perfil público')); });

    // Con el id, no sin él: sin `params` la ruta existe y la pantalla queda en
    // blanco, que es peor que no tener el renglón.
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/perfil/[usuarioId]',
      params: { usuarioId: 'u1' },
    });
  });

  it('«Mis publicaciones» y «Mi anuncio de roomie» llevan a su pestaña', async () => {
    await montar();
    await act(async () => { fireEvent.press(screen.getByText('Mis publicaciones')); });
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/publicaciones');

    await act(async () => { fireEvent.press(screen.getByText('Mi anuncio de roomie')); });
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/roomies');
  });
});

describe('el estado que muestran es el real', () => {
  it('distingue publicadas de activas', async () => {
    mockPublicaciones = [{ activa: true }, { activa: false }, { activa: true }];
    await montar();

    // Publicar y estar visible no es lo mismo. Una desactivada que uno cree
    // publicada es de las cosas que se descubren tarde y en mal momento.
    expect(screen.getByText('3 publicadas · 2 activas')).toBeTruthy();
  });

  it('dice el singular cuando es una sola', async () => {
    mockPublicaciones = [{ activa: true }];
    await montar();
    expect(screen.getByText('1 publicada · 1 activa')).toBeTruthy();
  });

  it('sin publicaciones lo dice, en vez de enseñar un cero', async () => {
    await montar();
    expect(screen.getByText('Todavía no has publicado ninguna.')).toBeTruthy();
  });

  it('un roomie pausado NO se anuncia como activo', async () => {
    // Tener ficha de roomie y aparecer en la lista son cosas distintas: la
    // suspensión de END-03 pone `pausado` sin borrar la ficha.
    mockRoomie = { estado: 'pausado' };
    await montar();
    expect(screen.getByText('Pausado: no apareces en la lista.')).toBeTruthy();
  });

  it('sin ficha de roomie dice que nadie te encuentra', async () => {
    mockRoomie = null;
    await montar();
    expect(screen.getByText('Sin crear. Nadie te encuentra como roomie.')).toBeTruthy();
  });
});
