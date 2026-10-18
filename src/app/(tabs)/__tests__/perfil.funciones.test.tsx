import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { clienteDePrueba } from '@pruebas/consultas';

// Cuervo 360 · «Tus funciones» está en Mi perfil.
//
// `SeccionFunciones` tiene sus propias pruebas, pero eso no demuestra que la pantalla la
// MUESTRE: borrar la línea que la monta dejaría todas en verde. Aquí se fija el cableado, y
// que reciba la cuenta de la sesión y no otra.

const mockObtener = jest.fn();
jest.mock('@/services/roles.service', () => ({
  obtenerMisRoles: (...a: unknown[]) => mockObtener(...a),
  agregarFuncion: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('@/services/usuarios.service', () => ({ eliminarMiCuenta: jest.fn(), exportarMisDatos: jest.fn() }));
jest.mock('@/lib/storage', () => ({ subirFotoPerfil: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({}) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ session: { user: { id: 'u-sesion', email: 'yo@ejemplo.mx' } }, cerrarSesion: jest.fn() }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({
    perfil: {
      id: 'u-sesion', nombre_usuario: 'yo', nombre_completo: 'Yo Prueba', biografia: '',
      universidad: 'UTVT', presupuesto_min: 2000, presupuesto_max: 4000,
      distancia_max_km: 10, nivel_ruido: 'bajo', mascotas: false, fuma: false,
      busca_roomie: true, consiente_analisis_ia: true, cuestionario_completo: true,
      foto_url: null, horario_predominante: 'mixto',
    },
    cargando: false,
    cargarPerfil: jest.fn(),
    actualizarPerfil: jest.fn(),
  }),
}));

import PerfilScreen from '../perfil';

const envolver = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={clienteDePrueba({ queries: { retry: false } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockObtener.mockResolvedValue([]);
});

test('Mi perfil muestra «Tus funciones» con Estudiante', async () => {
  await render(<PerfilScreen />, { wrapper: envolver });
  expect(await screen.findByText('Tus funciones', {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.getByText('Estudiante')).toBeTruthy();
});

test('pide los roles de la cuenta de la sesión, no de otra', async () => {
  await render(<PerfilScreen />, { wrapper: envolver });
  await screen.findByText('Tus funciones', {}, { timeout: 5000 });
  expect(mockObtener).toHaveBeenCalledWith('u-sesion');
});
