import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// «Personalización»: el interruptor del consentimiento a que se use tu descripción para ordenar lo que ves. No es un booleano suelto: APAGARLO borra el
// vector que ordena las sugerencias (si no, un texto que la persona dijo que no quiere analizado seguiría ordenándolo todo); ENCENDERLO lo recalcula; y si el
// servicio falla al recalcular NO se borra el vector anterior (la regla de `lib/perfilVector`: «no pudimos» no es «bórralo»). Es la misma lógica de Preferencias.

const mockActualizar = jest.fn();
const mockResolver = jest.fn();
const mockPush = jest.fn();
const mockInfo = jest.fn();
const mockError = jest.fn();
const almacen: { perfil: Record<string, unknown> } = { perfil: {} };

jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/toast', () => ({ toast: { info: (...a: unknown[]) => mockInfo(...a), error: (...a: unknown[]) => mockError(...a), exito: jest.fn() } }));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));
jest.mock('@/lib/perfilVector', () => ({
  ...jest.requireActual('@/lib/perfilVector'),
  resolverPerfilVector: (...a: unknown[]) => mockResolver(...a),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({ perfil: almacen.perfil, actualizarPerfil: (...a: unknown[]) => mockActualizar(...a) }),
}));

import PersonalizacionScreen from '../personalizacion';

const PERFIL = {
  id: 'u1', consiente_analisis_ia: true, universidad: 'UTVT', presupuesto_min: 2000, presupuesto_max: 4000,
  mascotas: false, fuma: false, nivel_ruido: 'bajo', perfil_texto: 'Estudio mecatrónica y soy tranquilo.',
};
const interruptor = () => screen.getByLabelText('Usar mi descripción');
const cambiar = async (valor: boolean) => { await act(async () => { fireEvent(interruptor(), 'valueChange', valor); }); };

beforeEach(() => {
  jest.clearAllMocks();
  almacen.perfil = { ...PERFIL };
  mockActualizar.mockResolvedValue(undefined);
  mockResolver.mockImplementation(async (consiente: boolean) =>
    consiente ? { estado: 'generado', vector: [0.1, 0.2] } : { estado: 'sin-consentimiento' }
  );
});

describe('el estado', () => {
  it('refleja el consentimiento real: activado', async () => {
    await render(<PersonalizacionScreen />);
    expect(interruptor().props.value).toBe(true);
  });

  it('y desactivado', async () => {
    almacen.perfil = { ...PERFIL, consiente_analisis_ia: false };
    await render(<PersonalizacionScreen />);
    expect(interruptor().props.value).toBe(false);
  });
});

describe('apagarla', () => {
  it('retira el consentimiento Y borra el vector que ordena las sugerencias', async () => {
    await render(<PersonalizacionScreen />);
    await cambiar(false);
    expect(mockActualizar).toHaveBeenCalledWith('u1', { consiente_analisis_ia: false, perfil_vector: null });
  });
});

describe('encenderla', () => {
  beforeEach(() => { almacen.perfil = { ...PERFIL, consiente_analisis_ia: false }; });

  it('recalcula el vector con el texto de la ficha y guarda consentimiento y vector', async () => {
    await render(<PersonalizacionScreen />);
    await cambiar(true);
    expect(mockResolver).toHaveBeenCalledWith(true, expect.stringContaining('Estudio mecatrónica'));
    expect(mockActualizar).toHaveBeenCalledWith('u1', { consiente_analisis_ia: true, perfil_vector: [0.1, 0.2] });
  });

  // «No pudimos recalcularlo» no es «bórralo»: el vector anterior sobrevive y se DICE que quedó atrás.
  it('si el servicio de análisis falla, guarda el consentimiento SIN tocar el vector anterior, y lo dice', async () => {
    mockResolver.mockResolvedValue({ estado: 'fallo', cuotaAgotada: false });
    await render(<PersonalizacionScreen />);
    await cambiar(true);
    const campos = mockActualizar.mock.calls[0][1];
    expect(campos).toEqual({ consiente_analisis_ia: true });
    expect(campos).not.toHaveProperty('perfil_vector');
    expect(mockInfo).toHaveBeenCalledWith(expect.stringMatching(/salvedad|servicio de análisis/i));
  });
});

describe('cuando algo falla', () => {
  it('si no se puede guardar, lo dice y el interruptor vuelve a donde estaba', async () => {
    mockActualizar.mockRejectedValue(new Error('sin red'));
    await render(<PersonalizacionScreen />);
    await cambiar(false);
    expect(mockError).toHaveBeenCalled();
    await waitFor(() => expect(interruptor().props.value).toBe(true));
  });

  it('dos cambios seguidos guardan UNA vez mientras el primero termina', async () => {
    let seguir!: () => void;
    mockActualizar.mockReturnValue(new Promise<void>((r) => { seguir = r; }));
    await render(<PersonalizacionScreen />);
    await cambiar(false);
    await cambiar(false);
    expect(mockActualizar).toHaveBeenCalledTimes(1);
    await act(async () => { seguir(); });
  });
});

describe('lo que dice', () => {
  it('explica qué se usa y qué no, y manda al aviso de privacidad', async () => {
    await render(<PersonalizacionScreen />);
    expect(screen.getByText('QUÉ USAMOS')).toBeTruthy();
    expect(screen.getByText('QUÉ NO USAMOS')).toBeTruthy();
    expect(screen.getByText(/INE/)).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText('Leer el aviso de privacidad')); });
    expect(mockPush).toHaveBeenCalledWith('/aviso-privacidad');
  });

  it('aclara que apagarla no rompe la app: ordena con tus filtros', async () => {
    await render(<PersonalizacionScreen />);
    expect(screen.getByText(/ordena con tus filtros/i)).toBeTruthy();
  });
});
