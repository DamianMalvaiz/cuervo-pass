import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// El paso optativo de verificar el rostro. Lo que se fija: no aparece mientras el aviso de privacidad no lo cubra; no se puede
// tomar la selfie sin el consentimiento aparte; y cada desenlace se dice con sus palabras (sin cifras, sin causa).

let mockHabilitada = true;
jest.mock('@/lib/rostro', () => {
  const real = jest.requireActual('@/lib/rostro');
  return Object.defineProperty({ ...real }, 'BIOMETRIA_HABILITADA', { enumerable: true, get: () => mockHabilitada });
});

const mockPermiso = jest.fn();
const mockCamara = jest.fn();
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: (...a: unknown[]) => mockPermiso(...a),
  launchCameraAsync: (...a: unknown[]) => mockCamara(...a),
  CameraType: { front: 'front' },
}));
const mockPreparar = jest.fn();
jest.mock('@/lib/selfie', () => ({ prepararSelfie: (...a: unknown[]) => mockPreparar(...a) }));
const mockEnviar = jest.fn();
jest.mock('@/services/rostro.service', () => ({ enviarSelfie: (...a: unknown[]) => mockEnviar(...a) }));

import { SeccionRostro } from '../SeccionRostro';

beforeEach(() => {
  jest.clearAllMocks();
  mockHabilitada = true;
  mockPermiso.mockResolvedValue({ granted: true, canAskAgain: true });
  mockCamara.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///selfie.jpg' }] });
  mockPreparar.mockResolvedValue('QUJD');
  mockEnviar.mockResolvedValue({ tipo: 'recibida', intentosRestantes: 4 });
});

const aceptarYTomar = async () => {
  await fireEvent.press(screen.getByLabelText(/Acepto que comparen mi rostro/));
  await fireEvent.press(screen.getByLabelText('Tomar selfie'));
};

describe('SeccionRostro', () => {
  it('no aparece mientras el aviso de privacidad no cubra la biometría', async () => {
    mockHabilitada = false;
    await render(<SeccionRostro rol="comerciante" />);
    expect(screen.queryByText(/rostro/i)).toBeNull();
  });

  it('dice que es opcional y enseña la guía de la selfie', async () => {
    await render(<SeccionRostro rol="comerciante" />);
    expect(screen.getAllByText(/opcional/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/a un brazo de distancia/)).toBeTruthy();
  });

  it('sin el consentimiento no se abre la cámara', async () => {
    await render(<SeccionRostro rol="comerciante" />);
    await fireEvent.press(screen.getByLabelText('Tomar selfie'));
    expect(mockCamara).not.toHaveBeenCalled();
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  it('la casilla nunca viene marcada', async () => {
    await render(<SeccionRostro rol="comerciante" />);
    expect(screen.getByLabelText(/Acepto que comparen mi rostro/).props.accessibilityState).toEqual({ checked: false });
  });

  it('con consentimiento abre la cámara FRONTAL, sin edición y sin galería', async () => {
    await render(<SeccionRostro rol="comerciante" />);
    await aceptarYTomar();
    await waitFor(() => expect(mockCamara).toHaveBeenCalled());
    expect(mockCamara.mock.calls[0][0]).toMatchObject({ cameraType: 'front', allowsEditing: false });
  });

  it('manda la selfie preparada, con el rol y la versión del aviso', async () => {
    await render(<SeccionRostro rol="arrendador" />);
    await aceptarYTomar();
    await waitFor(() => expect(mockEnviar).toHaveBeenCalled());
    expect(mockPreparar).toHaveBeenCalledWith('file:///selfie.jpg');
    expect(mockEnviar).toHaveBeenCalledWith('arrendador', 'QUJD', expect.any(String));
  });

  it('«recibida» no dice si coincidió ni enseña cifras', async () => {
    await render(<SeccionRostro rol="comerciante" />);
    await aceptarYTomar();
    expect(await screen.findByText(/Recibimos tu selfie/)).toBeTruthy();
    expect(screen.queryByText(/coincid|identidad|puntaje|\d\.\d/i)).toBeNull();
  });

  it('«repetir» pide otra foto y dice cuántos intentos quedan', async () => {
    mockEnviar.mockResolvedValue({ tipo: 'repetir', intentosRestantes: 2 });
    await render(<SeccionRostro rol="comerciante" />);
    await aceptarYTomar();
    expect(await screen.findByText(/No pudimos usar esa foto/)).toBeTruthy();
    expect(screen.getByText(/2 intentos/)).toBeTruthy();
    expect(screen.getByLabelText('Tomar selfie')).toBeTruthy();
  });

  it('sin intentos lo dice y la revisión manual sigue', async () => {
    mockEnviar.mockResolvedValue({ tipo: 'sin_intentos' });
    await render(<SeccionRostro rol="comerciante" />);
    await aceptarYTomar();
    expect(await screen.findByText(/Ya usaste tus intentos/)).toBeTruthy();
    expect(screen.queryByLabelText('Tomar selfie')).toBeNull();
  });

  it('servicio no disponible: lo dice y no culpa a la persona', async () => {
    mockEnviar.mockResolvedValue({ tipo: 'no_disponible' });
    await render(<SeccionRostro rol="comerciante" />);
    await aceptarYTomar();
    expect(await screen.findByText(/no está disponible/)).toBeTruthy();
  });

  it('un fallo de red se dice como fallo de red y se puede reintentar', async () => {
    mockEnviar.mockResolvedValue({ tipo: 'error' });
    await render(<SeccionRostro rol="comerciante" />);
    await aceptarYTomar();
    expect(await screen.findByText(/revisa tu conexión/i)).toBeTruthy();
    expect(screen.getByLabelText('Tomar selfie')).toBeTruthy();
  });

  it('si no da permiso de cámara no se envía nada y se explica', async () => {
    mockPermiso.mockResolvedValue({ granted: false, canAskAgain: true });
    await render(<SeccionRostro rol="comerciante" />);
    await aceptarYTomar();
    expect(await screen.findByText(/permiso de la cámara/i)).toBeTruthy();
    expect(mockCamara).not.toHaveBeenCalled();
  });

  it('cancelar la cámara no envía nada', async () => {
    mockCamara.mockResolvedValue({ canceled: true, assets: [] });
    await render(<SeccionRostro rol="comerciante" />);
    await aceptarYTomar();
    await waitFor(() => expect(mockCamara).toHaveBeenCalled());
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  it('si la selfie no se puede preparar, es un error y no se envía', async () => {
    mockPreparar.mockRejectedValue(new Error('x'));
    await render(<SeccionRostro rol="comerciante" />);
    await aceptarYTomar();
    expect(await screen.findByText(/No pudimos preparar/)).toBeTruthy();
    expect(mockEnviar).not.toHaveBeenCalled();
  });
});
