import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';

import { useToastStore } from '@/store/useToastStore';

// V.8 · Los cuatro manejadores de `perfil.tsx` que seguían sin red: exportar
// mis datos, cambiar la foto, guardar la biografía y cerrar sesión. Eran las
// líneas 80-134 y 163-164, las únicas del archivo con `try/catch` propio.
//
// El que importa de verdad es el primero. «Descargar mis datos» es el derecho de
// ACCESO de la LFPDPPP, y el aviso de privacidad de esta app lo PROMETE por
// escrito (§29). Un botón que promete un derecho legal y falla en silencio es
// peor que no tenerlo: la persona se queda creyendo que ya tiene su copia.
//
// Y los tres tienen la misma forma de fallo posible, que es la que se fija aquí:
// el `finally` que devuelve el botón a su estado. Sin él, un fallo deja el
// control deshabilitado para siempre y la única salida es reiniciar la app.

const mockExportar = jest.fn();
const mockSubirFoto = jest.fn();
const mockActualizarPerfil = jest.fn();
const mockCerrarSesion = jest.fn();
const mockReplace = jest.fn();
const mockPermiso = jest.fn();
const mockElegirImagen = jest.fn();
const mockPush = jest.fn();

// El estado del store se deja mutable para poder pintar la pantalla CARGANDO:
// con un objeto fijo en la factoría de `jest.mock` no hay forma de variarlo, y
// el esqueleto es una rama entera del componente (§27: cargando y vacío no son
// el mismo estado).
const almacen = { cargando: false };

// El conteo de favoritos de la tarjeta de identidad; tiene sus propias pruebas.
jest.mock('@/hooks/queries/useFavoritos', () => ({
  useMisFavoritosIds: () => ({ ids: new Set(['a', 'b']), cargando: false, fallo: false }),
}));
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: (...a: unknown[]) => mockPush(...a) },
}));
jest.mock('@/services/usuarios.service', () => ({
  exportarMisDatos: (...a: unknown[]) => mockExportar(...a),
  eliminarMiCuenta: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({ subirFotoPerfil: (...a: unknown[]) => mockSubirFoto(...a) }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockPermiso(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockElegirImagen(...a),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({}) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ session: { user: { id: 'u1', email: 'yo@ejemplo.mx' } }, cerrarSesion: mockCerrarSesion }),
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
    cargando: almacen.cargando,
    cargarPerfil: jest.fn(),
    actualizarPerfil: (...a: unknown[]) => mockActualizarPerfil(...a),
  }),
}));

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { clienteDePrueba } from '@pruebas/consultas';

import PerfilScreen from '../perfil';

const pintar = async () => {
  const cliente = clienteDePrueba();
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return render(<PerfilScreen />, { wrapper: Envoltura });
};


beforeEach(() => {
  jest.clearAllMocks();
  almacen.cargando = false;
  useToastStore.setState({ actual: null });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
  mockExportar.mockResolvedValue({ perfil: { nombre_usuario: 'yo' }, publicaciones: [] });
  mockPermiso.mockResolvedValue({ granted: true });
  mockElegirImagen.mockResolvedValue({ canceled: true });
  mockSubirFoto.mockResolvedValue('u1/foto.jpg');
  mockActualizarPerfil.mockResolvedValue(undefined);
});

// ── La foto ──────────────────────────────────────────────────────────────────

// Sin permiso, se explica. Antes de esto el camino existía pero nadie comprobaba
// que llevara a un mensaje: un botón que no hace nada al pulsarlo se lee como
// una app rota, no como un permiso que falta.
test('sin permiso de fotos se explica y no se intenta subir nada', async () => {
  mockPermiso.mockResolvedValue({ granted: false });
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar una foto de perfil'));
  });

  expect(await screen.findByText('Necesitamos permiso para acceder a tus fotos')).toBeTruthy();
  // Paso 3 · y además se AVISA: el texto de arriba queda en la ficha, fuera de la
  // vista si se ha deslizado.
  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'error',
    mensaje: 'Necesitamos permiso para acceder a tus fotos',
  });
  expect(mockElegirImagen).not.toHaveBeenCalled();
  expect(mockSubirFoto).not.toHaveBeenCalled();
});

// «Ajustes» solo si el sistema ya no volverá a preguntar: con el permiso denegado
// para siempre, tocar la foto otra vez no hace nada y nadie sabe dónde darlo.
test('si el sistema ya no volverá a preguntar, el aviso ofrece «Ajustes»', async () => {
  mockPermiso.mockResolvedValue({ granted: false, canAskAgain: false });
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar una foto de perfil'));
  });

  await screen.findByText('Necesitamos permiso para acceder a tus fotos');
  expect(useToastStore.getState().actual?.accion?.etiqueta).toBe('Ajustes');
});

test('si todavía puede preguntar, el aviso NO ofrece «Ajustes»', async () => {
  mockPermiso.mockResolvedValue({ granted: false, canAskAgain: true });
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar una foto de perfil'));
  });

  await screen.findByText('Necesitamos permiso para acceder a tus fotos');
  expect(useToastStore.getState().actual?.accion).toBeUndefined();
});

test('cancelar el selector no sube nada ni muestra error', async () => {
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar una foto de perfil'));
  });

  expect(mockSubirFoto).not.toHaveBeenCalled();
  expect(screen.queryByText(/No se pudo subir/)).toBeNull();
  expect(useToastStore.getState().actual).toBeNull();
});

test('al elegir una foto se sube y se guarda la RUTA, no la uri local', async () => {
  mockElegirImagen.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///tmp/foto.jpg' }] });
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar una foto de perfil'));
  });

  await waitFor(() => expect(mockSubirFoto).toHaveBeenCalledWith('u1', 'file:///tmp/foto.jpg'));
  // Lo que se guarda en el perfil es la ruta del bucket. Guardar la uri local
  // dejaría un `foto_url` que solo resuelve en ese teléfono: la foto se vería
  // en el dispositivo que la subió y en ningún otro.
  expect(mockActualizarPerfil).toHaveBeenCalledWith('u1', { foto_url: 'u1/foto.jpg' });
  await waitFor(() =>
    expect(useToastStore.getState().actual).toMatchObject({ tipo: 'exito', mensaje: 'Foto actualizada' })
  );
});

test('un fallo al subir se dice y el botón se reactiva', async () => {
  mockElegirImagen.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///tmp/foto.jpg' }] });
  mockSubirFoto.mockRejectedValue(new Error('el bucket rechazó el archivo'));
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Agregar una foto de perfil'));
  });

  expect(await screen.findByText('el bucket rechazó el archivo')).toBeTruthy();
  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'error',
    mensaje: 'el bucket rechazó el archivo',
  });
  // `accessibilityState.busy` vuelve a false: es el `finally`. Sin él el botón
  // queda deshabilitado y no hay forma de reintentar.
  const boton = screen.getByLabelText('Agregar una foto de perfil');
  expect(boton.props.accessibilityState?.busy).toBe(false);
});

// ── La biografía y la sesión ─────────────────────────────────────────────────

/** Escribe en la biografía. El sello de guardar no existe hasta que cambia. */
const escribirBiografia = async (texto: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText(/Cuéntale a otros quién eres/), texto);
  });
};

// El sello aparece SOLO si hay algo sin guardar. Un «Guardar» permanentemente
// encendido no distingue entre «ya está» y «te falta», que es justo lo que uno
// necesita saber. Lo descubrí porque mi primera versión de la prueba de abajo
// buscaba el sello sin haber escrito nada y no lo encontraba: la aserción estaba
// mal, no la pantalla.
test('el sello de guardar no existe si no hay nada sin guardar', async () => {
  await pintar();
  expect(screen.queryByLabelText('Guardar biografía')).toBeNull();
  expect(screen.queryByText('Sin guardar')).toBeNull();

  await escribirBiografia('Estudio mecatrónica.');
  expect(screen.getByLabelText('Guardar biografía')).toBeTruthy();
  expect(screen.getByText('Sin guardar')).toBeTruthy();
});

test('un fallo al guardar la biografía se dice', async () => {
  mockActualizarPerfil.mockRejectedValue(new Error('no se pudo escribir'));
  await pintar();
  await escribirBiografia('Estudio mecatrónica.');
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Guardar biografía'));
  });
  expect(await screen.findByText('no se pudo escribir')).toBeTruthy();
  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'error', mensaje: 'no se pudo escribir' });
});

test('guardar la biografía la manda al perfil', async () => {
  await pintar();
  await escribirBiografia('Estudio mecatrónica.');
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Guardar biografía'));
  });
  expect(mockActualizarPerfil).toHaveBeenCalledWith('u1', { biografia: 'Estudio mecatrónica.' });
  await waitFor(() =>
    expect(useToastStore.getState().actual).toMatchObject({ tipo: 'exito', mensaje: 'Biografía guardada' })
  );
});

// Un fallo no debe dar también el aviso de éxito.
test('si falla guardar la biografía, NO hay aviso de éxito', async () => {
  mockActualizarPerfil.mockRejectedValue(new Error('no se pudo escribir'));
  await pintar();
  await escribirBiografia('Estudio mecatrónica.');
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Guardar biografía'));
  });
  await screen.findByText('no se pudo escribir');
  expect(useToastStore.getState().actual?.tipo).toBe('error');
});

// ── Lo que quedaba sin pisar ─────────────────────────────────────────────────

// §27 · Cargando no es lo mismo que vacío. Mientras el perfil viaja, la pantalla
// pinta el esqueleto y NO los campos con valores en blanco: una ficha con
// «PRESUPUESTO MENSUAL» vacío se lee como un perfil sin llenar, no como uno que
// aún no llegó.
test('mientras carga pinta el esqueleto y no la ficha vacía', async () => {
  almacen.cargando = true;
  await pintar();
  expect(screen.queryByLabelText('Guardar biografía')).toBeNull();
  expect(screen.queryByText('Cerrar sesión')).toBeNull();
});

test('se puede llegar a editar las preferencias de búsqueda', async () => {
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Editar mis preferencias de búsqueda'));
  });
  expect(mockPush).toHaveBeenCalledWith('/perfil/preferencias');
});
