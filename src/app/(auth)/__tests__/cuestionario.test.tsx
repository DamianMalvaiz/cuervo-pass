import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

// V.8 · El cuestionario inicial, y en concreto §29 · AUD-23: el camino SIN IA.
//
// La casilla del análisis con IA no viene premarcada, y eso solo significa algo
// si NO consentir tiene efecto de verdad: no se llama al modelo, no se genera
// vector, y esa persona recibe sugerencias de Nivel 1. Una casilla que se puede
// dejar sin marcar mientras el sistema consulta igual es decorativa, y es
// exactamente lo que la LFPDPPP no permite.
//
// Tiene además un beneficio práctico: obliga a que el camino sin IA funcione,
// que es al que degrada todo el sistema cuando el microservicio se cae.
//
// Se mockea `FormularioCuestionario` a propósito. Lo que está al 0 % es la
// LÓGICA de esta pantalla —qué se guarda y cuándo se llama al modelo—, no el
// formulario; rellenar dieciséis campos por la interfaz para llegar aquí
// probaría sobre todo el formulario, que además merece sus propias pruebas.

const mockParsear = jest.fn();
const mockGenerarEmbedding = jest.fn();
const mockActualizarPerfil = jest.fn();
const mockReplace = jest.fn();
const mockGeocodificar = jest.fn();

const RESPUESTAS = {
  universidad: 'Universidad Tecnológica del Valle de Toluca (UTVT)',
  universidadCoords: { lat: 19.32, lng: -99.45 },
  presupuestoMin: 2000,
  presupuestoMax: 4000,
  distanciaMaxKm: 10,
  mascotas: false,
  fuma: false,
  nivelRuido: 'bajo' as const,
  buscaRoomie: false,
  textoLibre: 'Soy tranquilo y estudio de noche.',
  consienteIa: false,
};

jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock('@/lib/aiService', () => ({
  parsearPerfil: (...a: unknown[]) => mockParsear(...a),
  generarEmbedding: (...a: unknown[]) => mockGenerarEmbedding(...a),
  ServicioIaError: class extends Error { cuotaAgotada = false; },
}));
jest.mock('@/lib/geocoding', () => ({ geocodificarDireccion: (...a: unknown[]) => mockGeocodificar(...a) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: (sel: (s: unknown) => unknown) => sel({ actualizarPerfil: mockActualizarPerfil }),
}));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

// El formulario se sustituye por un botón que entrega unas respuestas fijas.
// El prefijo `mock` lo exige jest: una fábrica de jest.mock() no puede
// referenciar variables de fuera salvo que se llamen así.
let mockRespuestas = RESPUESTAS;
const mockCapturado: { desplazador?: { alNodo?: unknown } } = {};
jest.mock('@/components/FormularioCuestionario', () => ({
  FormularioCuestionario: ({
    onCompletar,
    desplazador,
  }: {
    onCompletar: (r: unknown) => void;
    desplazador?: { alNodo?: unknown };
  }) => {
    const { Pressable: P, Text: T } = require('react-native');
    mockCapturado.desplazador = desplazador;
    return (
      <P accessibilityRole="button" accessibilityLabel="Completar" onPress={() => onCompletar(mockRespuestas)}>
        <T>Completar</T>
      </P>
    );
  },
}));

import CuestionarioInicialScreen from '../cuestionario-inicial';

const completar = async () => {
  await render(<CuestionarioInicialScreen />);
  await act(async () => { fireEvent.press(screen.getByLabelText('Completar')); });
};

const guardado = () => mockActualizarPerfil.mock.calls[0][1];

beforeEach(() => {
  jest.clearAllMocks();
  mockRespuestas = { ...RESPUESTAS };
  mockActualizarPerfil.mockResolvedValue(undefined);
  mockGenerarEmbedding.mockResolvedValue([0.1, 0.2]);
  mockParsear.mockResolvedValue({ horario_predominante: 'nocturno', degradado: false });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('sin consentimiento · §29 · AUD-23', () => {
  it('NO llama al modelo ni al embedding', async () => {
    await completar();
    await waitFor(() => expect(mockActualizarPerfil).toHaveBeenCalled());

    expect(mockParsear).not.toHaveBeenCalled();
    expect(mockGenerarEmbedding).not.toHaveBeenCalled();
  });

  it('guarda el consentimiento en false y limpia el vector', async () => {
    await completar();
    await waitFor(() => expect(mockActualizarPerfil).toHaveBeenCalled());

    // `perfil_vector: null` y no «no tocar»: retirar el consentimiento tiene
    // que borrar el embedding anterior, o queda dando vueltas un derivado del
    // texto de alguien que pidió que no se analizara.
    expect(guardado()).toMatchObject({ consiente_analisis_ia: false, perfil_vector: null });
  });

  it('guarda las respuestas y marca el cuestionario como completo', async () => {
    await completar();
    await waitFor(() => expect(mockActualizarPerfil).toHaveBeenCalled());

    // `cuestionario_completo` es lo que el guard de §26 lee para dejar entrar a
    // las pestañas. Se escribe al final, cuando ya quedó todo lo demás.
    expect(guardado()).toMatchObject({
      universidad: RESPUESTAS.universidad,
      presupuesto_min: 2000,
      presupuesto_max: 4000,
      cuestionario_completo: true,
      latitud_universidad: 19.32,
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/inicio');
  });

  it('con universidad de la lista curada, no geocodifica', async () => {
    // Las coordenadas de la lista están verificadas a mano. Geocodificar
    // «UTVT» como texto libre devuelve lugares que no son.
    await completar();
    await waitFor(() => expect(mockActualizarPerfil).toHaveBeenCalled());
    expect(mockGeocodificar).not.toHaveBeenCalled();
  });
});

describe('con consentimiento', () => {
  beforeEach(() => { mockRespuestas = { ...RESPUESTAS, consienteIa: true }; });

  it('genera el vector y lo guarda', async () => {
    await completar();
    await waitFor(() => expect(mockActualizarPerfil).toHaveBeenCalled());

    expect(mockGenerarEmbedding).toHaveBeenCalled();
    expect(guardado()).toMatchObject({ consiente_analisis_ia: true, perfil_vector: [0.1, 0.2] });
  });

  it('si el microservicio se cae, el registro NO se bloquea y se avisa', async () => {
    // §27: un fallo del servicio no puede impedir terminar el alta. Y NO se
    // escribe `perfil_vector: null` — un hipo de red no es retirar el
    // consentimiento, que es justo la distinción de perfilVector.ts.
    mockGenerarEmbedding.mockRejectedValue(new Error('sin conexión'));
    await completar();
    await waitFor(() => expect(mockActualizarPerfil).toHaveBeenCalled());

    expect(guardado()).toMatchObject({ consiente_analisis_ia: true });
    expect(guardado()).not.toHaveProperty('perfil_vector');
    expect(Alert.alert).toHaveBeenCalled();
  });
});

// Scroll al primer error. El ScrollView es de esta pantalla: sin el `desplazador`,
// un envío inválido solo avisaría y la vista se quedaría donde estaba.
test('le pasa al formulario un desplazador para llevar la vista al error', async () => {
  await render(<CuestionarioInicialScreen />);
  expect(typeof mockCapturado.desplazador?.alNodo).toBe('function');
});
