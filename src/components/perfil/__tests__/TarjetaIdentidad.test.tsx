import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useToastStore } from '@/store/useToastStore';

// La tarjeta de identidad del perfil: foto (con la cámara encima), nombre, usuario, universidad y una etiqueta de estado. Las pruebas de la foto vivían
// en la pantalla de perfil; al compartir la tarjeta entre el perfil de estudiante y el de vendedor se movieron aquí, que es donde vive el comportamiento.
//
// Los tres caminos de la foto se fijan: sin permiso se explica (con «Ajustes» solo si el sistema ya no volverá a preguntar), cancelar no hace nada, y
// subir guarda la RUTA y no la uri local. Y el fallo: el `finally` devuelve el botón a su estado; sin él queda deshabilitado hasta reiniciar la app.

const mockSubirFoto = jest.fn();
const mockActualizarPerfil = jest.fn();
const mockPermiso = jest.fn();
const mockElegirImagen = jest.fn();
const almacen: { perfil: Record<string, unknown> | null } = { perfil: null };

jest.mock('@/lib/storage', () => ({ subirFotoPerfil: (...a: unknown[]) => mockSubirFoto(...a) }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockPermiso(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockElegirImagen(...a),
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map() }) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({ perfil: almacen.perfil, actualizarPerfil: (...a: unknown[]) => mockActualizarPerfil(...a) }),
}));

import { Text } from 'react-native';

import { TarjetaIdentidad } from '../TarjetaIdentidad';

const PERFIL = { id: 'u1', nombre_usuario: 'yo', nombre_completo: 'Yo Prueba', universidad: 'UTVT', foto_url: null };

beforeEach(() => {
  jest.clearAllMocks();
  almacen.perfil = { ...PERFIL };
  useToastStore.setState({ actual: null });
  mockPermiso.mockResolvedValue({ granted: true });
  mockElegirImagen.mockResolvedValue({ canceled: true });
  mockSubirFoto.mockResolvedValue('u1/foto.jpg');
  mockActualizarPerfil.mockResolvedValue(undefined);
});

const tocarFoto = async () => {
  await act(async () => { fireEvent.press(screen.getByLabelText('Agregar una foto de perfil')); });
};

describe('la foto', () => {
  it('sin permiso se explica, se avisa y no se intenta subir nada', async () => {
    mockPermiso.mockResolvedValue({ granted: false });
    await render(<TarjetaIdentidad />);
    await tocarFoto();

    expect(await screen.findByText('Necesitamos permiso para acceder a tus fotos')).toBeTruthy();
    expect(useToastStore.getState().actual).toMatchObject({ tipo: 'error', mensaje: 'Necesitamos permiso para acceder a tus fotos' });
    expect(mockElegirImagen).not.toHaveBeenCalled();
    expect(mockSubirFoto).not.toHaveBeenCalled();
  });

  it('si el sistema ya no volverá a preguntar, el aviso ofrece «Ajustes»', async () => {
    mockPermiso.mockResolvedValue({ granted: false, canAskAgain: false });
    await render(<TarjetaIdentidad />);
    await tocarFoto();
    await screen.findByText('Necesitamos permiso para acceder a tus fotos');
    expect(useToastStore.getState().actual?.accion?.etiqueta).toBe('Ajustes');
  });

  it('si todavía puede preguntar, el aviso NO ofrece «Ajustes»', async () => {
    mockPermiso.mockResolvedValue({ granted: false, canAskAgain: true });
    await render(<TarjetaIdentidad />);
    await tocarFoto();
    await screen.findByText('Necesitamos permiso para acceder a tus fotos');
    expect(useToastStore.getState().actual?.accion).toBeUndefined();
  });

  it('cancelar el selector no sube nada ni muestra error', async () => {
    await render(<TarjetaIdentidad />);
    await tocarFoto();
    expect(mockSubirFoto).not.toHaveBeenCalled();
    expect(screen.queryByText(/No se pudo subir/)).toBeNull();
    expect(useToastStore.getState().actual).toBeNull();
  });

  it('al elegir una foto se sube y se guarda la RUTA, no la uri local', async () => {
    mockElegirImagen.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///tmp/foto.jpg' }] });
    await render(<TarjetaIdentidad />);
    await tocarFoto();

    await waitFor(() => expect(mockSubirFoto).toHaveBeenCalledWith('u1', 'file:///tmp/foto.jpg'));
    // Guardar la uri local dejaría un `foto_url` que solo resuelve en ese teléfono.
    expect(mockActualizarPerfil).toHaveBeenCalledWith('u1', { foto_url: 'u1/foto.jpg' });
    await waitFor(() => expect(useToastStore.getState().actual).toMatchObject({ tipo: 'exito', mensaje: 'Foto actualizada' }));
  });

  it('un fallo al subir se dice y el botón se reactiva', async () => {
    mockElegirImagen.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///tmp/foto.jpg' }] });
    mockSubirFoto.mockRejectedValue(new Error('el bucket rechazó el archivo'));
    await render(<TarjetaIdentidad />);
    await tocarFoto();

    expect(await screen.findByText('el bucket rechazó el archivo')).toBeTruthy();
    expect(useToastStore.getState().actual).toMatchObject({ tipo: 'error', mensaje: 'el bucket rechazó el archivo' });
    expect(screen.getByLabelText('Agregar una foto de perfil').props.accessibilityState?.busy).toBe(false);
  });
});

describe('lo que dice la tarjeta', () => {
  it('sin nombre ni usuario pone marcadores, no huecos', async () => {
    almacen.perfil = { ...PERFIL, nombre_completo: null, nombre_usuario: null };
    await render(<TarjetaIdentidad />);
    expect(screen.getByText('Sin nombre')).toBeTruthy();
    expect(screen.getByText('@—')).toBeTruthy();
  });

  it('sin universidad no se pinta esa línea; con ella, sí', async () => {
    almacen.perfil = { ...PERFIL, universidad: null };
    await render(<TarjetaIdentidad />);
    expect(screen.queryByText('UTVT')).toBeNull();
  });

  it('con universidad se pinta', async () => {
    await render(<TarjetaIdentidad />);
    expect(screen.getByText('UTVT')).toBeTruthy();
  });

  it('sin foto el botón dice agregar', async () => {
    await render(<TarjetaIdentidad />);
    expect(screen.getByLabelText('Agregar una foto de perfil')).toBeTruthy();
  });

  it('lleva la insignia que se le pasa, y ninguna si no se le pasa', async () => {
    await render(<TarjetaIdentidad insignia="Correo verificado" />);
    expect(screen.getByText('Correo verificado')).toBeTruthy();
  });

  it('sin insignia no inventa una', async () => {
    await render(<TarjetaIdentidad />);
    expect(screen.queryByText(/verificad/i)).toBeNull();
  });

  it('pinta lo que va dentro', async () => {
    await render(<TarjetaIdentidad><Text>DENTRO</Text></TarjetaIdentidad>);
    expect(screen.getByText('DENTRO')).toBeTruthy();
  });
});
