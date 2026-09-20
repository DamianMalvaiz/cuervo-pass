import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

// El derecho de CANCELACION (ARCO) estaba roto hasta el 19/09/2026: la Edge
// Function devolvia un no-2xx para cualquiera que hubiera subido una foto,
// porque el trigger trg_limpiar_fotos hacia `delete from storage.objects` y
// Supabase lo prohibe. Eso ya se arreglo y se verifico contra produccion.
//
// Lo que NO se habia probado nunca es la PANTALLA: que confirme dos veces, que
// diga lo que desaparece, que navegue al login al terminar, y —sobre todo— que
// si la funcion falla NO deje a la persona creyendo que su cuenta se borro.
// Arreglar el backend no sirve de nada si el boton que lo llama esta roto.

const mockEliminarMiCuenta = jest.fn();
const mockReplace = jest.fn();
const mockCargarPerfil = jest.fn();

jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a), push: jest.fn() } }));
jest.mock('@/services/usuarios.service', () => ({
  eliminarMiCuenta: (...a: unknown[]) => mockEliminarMiCuenta(...a),
  exportarMisDatos: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({ subirFotoPerfil: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({}) }));
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
      busca_roomie: true, consiente_analisis_ia: true, cuestionario_completo: true,
      foto_url: null, horario_predominante: 'mixto',
    },
    cargando: false,
    cargarPerfil: mockCargarPerfil,
    actualizarPerfil: jest.fn(),
  }),
}));

import PerfilScreen from '../perfil';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

const abrirDialogo = async () => {
  await render(<PerfilScreen />);
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
