import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Verificación de vendedor · la pantalla. Lo que se fija: solo muestra el formulario cuando de verdad se puede enviar
// (sin verificar o rechazada), dice en qué estado va en los demás casos, valida antes de subir nada, y un envío fallido
// se dice como fallo sin inventar éxitos.

const mockParams = { rol: 'comerciante' };
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockRoles = jest.fn();
const mockMiVerif = jest.fn();
const mockMutate = jest.fn();
const mockPermiso = jest.fn();
const mockElegir = jest.fn();
const mockExito = jest.fn();
const mockError = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { back: (...a: unknown[]) => mockBack(...a), push: (...a: unknown[]) => mockPush(...a) },
}));
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: (...a: unknown[]) => mockRoles(...a) }));
jest.mock('@/hooks/queries/useVerificacion', () => ({
  useMiVerificacion: (...a: unknown[]) => mockMiVerif(...a),
  useEnviarVerificacion: () => ({ mutate: (...a: unknown[]) => mockMutate(...a), isPending: false }),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockPermiso(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockElegir(...a),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/toast', () => ({
  toast: { exito: (...a: unknown[]) => mockExito(...a), error: (...a: unknown[]) => mockError(...a), info: jest.fn() },
}));

import VerificacionScreen from '../[rol]';

const rolConEstado = (estado: string, origen = 'solicitud', rol = 'comerciante') => ({
  roles: [{ usuario_id: 'u1', rol, estado, origen, desde: 'x' }],
  cargando: false, fallo: false, reintentar: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.rol = 'comerciante';
  mockRoles.mockReturnValue(rolConEstado('sin_verificar'));
  mockMiVerif.mockReturnValue({ verificacion: null, cargando: false, fallo: false, reintentar: jest.fn() });
  mockPermiso.mockResolvedValue({ granted: true });
  let n = 0;
  mockElegir.mockImplementation(async () => ({ canceled: false, assets: [{ uri: `file:///foto-${++n}.jpg` }] }));
});

const pulsar = async (etiqueta: string | RegExp) => {
  await act(async () => { fireEvent.press(screen.getByLabelText(etiqueta)); });
};

/** Llena todo el formulario. */
const llenar = async () => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText('Nombre completo (como en tu INE)'), 'Ana Prueba Ruiz');
    fireEvent.changeText(screen.getByLabelText('Dirección de tu negocio'), 'Calle 1, Lerma');
  });
  await pulsar('Elegir: Foto del frente de tu INE');
  await pulsar('Elegir: Foto del reverso de tu INE');
  await pulsar('Agregar una foto del lugar');
  await pulsar(/Acepto que revisen/);
};

describe('según el estado', () => {
  it('sin verificar muestra el formulario', async () => {
    await render(<VerificacionScreen />);
    expect(screen.getByText('Verificación de comerciante')).toBeTruthy();
    expect(screen.getByLabelText('Enviar a revisión')).toBeTruthy();
  });

  it('rechazada muestra el motivo Y el formulario para reenviar', async () => {
    mockRoles.mockReturnValue(rolConEstado('rechazado'));
    mockMiVerif.mockReturnValue({ verificacion: { motivo_rechazo: 'La INE no se lee' }, cargando: false, fallo: false, reintentar: jest.fn() });
    await render(<VerificacionScreen />);
    expect(screen.getByText('Tu verificación fue rechazada')).toBeTruthy();
    expect(screen.getByText('Motivo: La INE no se lee')).toBeTruthy();
    expect(screen.getByLabelText('Enviar a revisión')).toBeTruthy();
  });

  it('pendiente dice «En revisión» y NO muestra el formulario', async () => {
    mockRoles.mockReturnValue(rolConEstado('pendiente'));
    await render(<VerificacionScreen />);
    expect(screen.getByText('En revisión')).toBeTruthy();
    expect(screen.queryByLabelText('Enviar a revisión')).toBeNull();
  });

  it('aprobada dice «Verificada» y no muestra el formulario', async () => {
    mockRoles.mockReturnValue(rolConEstado('aprobado'));
    await render(<VerificacionScreen />);
    expect(screen.getByText('Verificada')).toBeTruthy();
    expect(screen.queryByLabelText('Enviar a revisión')).toBeNull();
  });

  it('una función heredada lo dice: no pasó por una revisión', async () => {
    mockRoles.mockReturnValue(rolConEstado('aprobado', 'migracion'));
    await render(<VerificacionScreen />);
    expect(screen.getByText('Función heredada')).toBeTruthy();
    expect(screen.getByText(/No pasó por una revisión/)).toBeTruthy();
  });

  it('sin tener la función, manda a agregarla primero', async () => {
    mockRoles.mockReturnValue({ roles: [], cargando: false, fallo: false, reintentar: jest.fn() });
    await render(<VerificacionScreen />);
    expect(screen.getByText(/Primero agrega esta función/)).toBeTruthy();
    expect(screen.queryByLabelText('Enviar a revisión')).toBeNull();
  });

  it('un rol que no es de vendedor no existe', async () => {
    mockParams.rol = 'admin';
    await render(<VerificacionScreen />);
    expect(screen.getByText('Esta pantalla no existe.')).toBeTruthy();
  });

  it('mientras cargan los roles no decide nada', async () => {
    mockRoles.mockReturnValue({ roles: [], cargando: true, fallo: false, reintentar: jest.fn() });
    await render(<VerificacionScreen />);
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
    expect(screen.queryByText(/Primero agrega/)).toBeNull();
  });

  it('si falló la lectura de roles lo dice y NO afirma que no tengas la función', async () => {
    const reintentar = jest.fn();
    mockRoles.mockReturnValue({ roles: [], cargando: false, fallo: true, reintentar });
    await render(<VerificacionScreen />);
    expect(screen.queryByText(/Primero agrega/)).toBeNull();
    await pulsar('Reintentar');
    expect(reintentar).toHaveBeenCalled();
  });

  it('el arrendador pide el inmueble, no el negocio', async () => {
    mockParams.rol = 'arrendador';
    mockRoles.mockReturnValue(rolConEstado('sin_verificar', 'solicitud', 'arrendador'));
    await render(<VerificacionScreen />);
    expect(screen.getByText('Verificación de arrendador')).toBeTruthy();
    expect(screen.getByLabelText('Dirección del inmueble')).toBeTruthy();
  });
});

describe('el envío', () => {
  it('con el formulario vacío NO envía y dice qué falta', async () => {
    await render(<VerificacionScreen />);
    await pulsar('Enviar a revisión');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Falta la foto del frente de tu INE')).toBeTruthy();
    expect(screen.getByText('Falta la foto del reverso de tu INE')).toBeTruthy();
    expect(screen.getByText('Agrega al menos una foto de tu negocio')).toBeTruthy();
    expect(screen.getByText('Necesitamos tu consentimiento para revisar tus documentos')).toBeTruthy();
  });

  it('sin consentimiento no envía aunque todo lo demás esté', async () => {
    await render(<VerificacionScreen />);
    await llenar();
    await pulsar(/Acepto que revisen/); // lo desmarca
    await pulsar('Enviar a revisión');
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('completo, envía con las URIs de cada foto', async () => {
    await render(<VerificacionScreen />);
    await llenar();
    await pulsar('Enviar a revisión');
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      rol: 'comerciante', nombreLegal: 'Ana Prueba Ruiz', direccion: 'Calle 1, Lerma',
      ineFrente: 'file:///foto-1.jpg', ineReverso: 'file:///foto-2.jpg', fotosLugar: ['file:///foto-3.jpg'],
    });
  });

  it('al enviar bien avisa y vuelve atrás', async () => {
    mockMutate.mockImplementation((_e, { onSuccess }) => onSuccess());
    await render(<VerificacionScreen />);
    await llenar();
    await pulsar('Enviar a revisión');
    expect(mockExito).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });

  it('un fallo de red se dice como fallo, sin éxito y sin volver atrás', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError(new Error('Network request failed')));
    await render(<VerificacionScreen />);
    await llenar();
    await pulsar('Enviar a revisión');
    expect(String(mockError.mock.calls[0][0])).toMatch(/conexión/);
    expect(mockExito).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('CP005 se explica por código: ya no se puede enviar', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError({ code: 'CP005', message: 'x' }));
    await render(<VerificacionScreen />);
    await llenar();
    await pulsar('Enviar a revisión');
    expect(String(mockError.mock.calls[0][0])).toMatch(/ya no se puede enviar/);
  });
});

describe('las fotos', () => {
  it('sin permiso de galería no agrega nada', async () => {
    mockPermiso.mockResolvedValue({ granted: false, canAskAgain: true });
    await render(<VerificacionScreen />);
    await pulsar('Elegir: Foto del frente de tu INE');
    expect(mockElegir).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalled();
  });

  it('cancelar el selector no agrega nada', async () => {
    mockElegir.mockResolvedValue({ canceled: true });
    await render(<VerificacionScreen />);
    await pulsar('Elegir: Foto del frente de tu INE');
    expect(screen.queryByLabelText('Cambiar: Foto del frente de tu INE')).toBeNull();
  });

  it('una foto del lugar se puede quitar', async () => {
    await render(<VerificacionScreen />);
    await pulsar('Agregar una foto del lugar');
    expect(screen.getByLabelText('Quitar la foto 1')).toBeTruthy();
    await pulsar('Quitar la foto 1');
    expect(screen.queryByLabelText('Quitar la foto 1')).toBeNull();
  });

  it('al llegar al máximo ya no ofrece agregar más', async () => {
    await render(<VerificacionScreen />);
    for (let i = 0; i < 6; i++) await pulsar('Agregar una foto del lugar');
    expect(screen.queryByLabelText('Agregar una foto del lugar')).toBeNull();
  });
});

test('el aviso de privacidad se puede abrir desde aquí', async () => {
  await render(<VerificacionScreen />);
  await pulsar('Leer el aviso de privacidad');
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/aviso-privacidad'));
});
