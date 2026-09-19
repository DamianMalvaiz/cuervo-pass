import { render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Esta pantalla no tenia ninguna prueba, y es donde vivia el fallo del
// 19/09/2026: un hipo del servicio de IA borraba el perfil_vector como si la
// persona hubiera retirado el consentimiento. Lo unico que lo delataba era un
// console.warn que no ve nadie.
//
// El formulario se sustituye por un doble que llama a onCompletar en cuanto se
// monta. No es pereza: lo que se quiere probar es la DECISION de la pantalla
// sobre que escribir, no el renderizado de cinco secciones de campos —que ya
// cubre react-hook-form con su propio esquema de Zod.

const mockActualizarPerfil = jest.fn();
const mockBack = jest.fn();
const mockGenerarEmbedding = jest.fn();

let mockRespuestas: Record<string, unknown> = {};
let mockPerfilActual: Record<string, unknown> = {};

jest.mock('expo-router', () => ({ router: { back: () => mockBack() } }));

jest.mock('@/components/FormularioCuestionario', () => {
  const React = require('react');
  return {
    FormularioCuestionario: ({ onCompletar }: { onCompletar: (r: unknown) => void }) => {
      // Una sola vez al montar, que es lo que hace una persona al pulsar
      // "Guardar". Con onCompletar en las dependencias se dispararia en bucle.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      React.useEffect(() => { void onCompletar(mockRespuestas); }, []);
      return null;
    },
  };
});

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({ perfil: mockPerfilActual, actualizarPerfil: mockActualizarPerfil }),
}));
jest.mock('@/lib/geocoding', () => ({ geocodificarDireccion: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/aiService', () => {
  class ServicioIaError extends Error {
    constructor(m: string, readonly cuotaAgotada = false) { super(m); this.name = 'ServicioIaError'; }
  }
  return {
    ServicioIaError,
    generarEmbedding: (...a: unknown[]) => mockGenerarEmbedding(...a),
    parsearPerfil: jest.fn().mockResolvedValue({ degradado: true }),
  };
});

import PreferenciasScreen from '../preferencias';

const vector = Array.from({ length: 384 }, (_, i) => i / 384);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockPerfilActual = { perfil_vector: vector, consiente_analisis_ia: true };
  mockRespuestas = {
    universidad: 'UTVT', presupuestoMin: 2000, presupuestoMax: 4000, distanciaMaxKm: 10,
    mascotas: false, fuma: false, nivelRuido: 'bajo', buscaRoomie: true,
    textoLibre: 'tranquilo', consienteIa: true,
  };
});

const camposGuardados = () => mockActualizarPerfil.mock.calls[0][1];

test('con el servicio vivo guarda el vector nuevo', async () => {
  mockGenerarEmbedding.mockResolvedValue(vector);
  render(<PreferenciasScreen />);
  await waitFor(() => expect(mockActualizarPerfil).toHaveBeenCalled());
  expect(camposGuardados().perfil_vector).toEqual(vector);
  expect(Alert.alert).not.toHaveBeenCalled();
});

// LA prueba. Antes de la correccion esto escribia perfil_vector: null y la
// persona se quedaba sin Nivel 2 para siempre, sin enterarse.
test('si el servicio falla NO se toca la columna del vector', async () => {
  mockGenerarEmbedding.mockRejectedValue(new Error('sin conexión'));
  render(<PreferenciasScreen />);
  await waitFor(() => expect(mockActualizarPerfil).toHaveBeenCalled());
  const campos = camposGuardados();
  expect(Object.prototype.hasOwnProperty.call(campos, 'perfil_vector')).toBe(false);
  // El resto del formulario SI se guarda: el fallo es solo de la parte semantica.
  expect(campos.presupuesto_max).toBe(4000);
});

test('si el servicio falla se avisa en pantalla, no en la consola', async () => {
  mockGenerarEmbedding.mockRejectedValue(new Error('sin conexión'));
  render(<PreferenciasScreen />);
  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  const [titulo, cuerpo] = (Alert.alert as jest.Mock).mock.calls[0];
  expect(titulo).toMatch(/salvedad/i);
  expect(cuerpo).toMatch(/anterior/i);
});

// Retirar el consentimiento SI debe borrarlo: es el derecho de oposicion.
test('retirar el consentimiento borra el vector a proposito', async () => {
  mockRespuestas = { ...mockRespuestas, consienteIa: false };
  render(<PreferenciasScreen />);
  await waitFor(() => expect(mockActualizarPerfil).toHaveBeenCalled());
  expect(camposGuardados().perfil_vector).toBeNull();
  expect(camposGuardados().consiente_analisis_ia).toBe(false);
  expect(mockGenerarEmbedding).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

// Sin aviso no se navega: si la pantalla se cerrara sola, el Alert quedaria
// huerfano sobre la pantalla anterior y nadie ataria una cosa con la otra.
test('con el aviso, volver atras ocurre al cerrarlo y no antes', async () => {
  mockGenerarEmbedding.mockRejectedValue(new Error('sin conexión'));
  render(<PreferenciasScreen />);
  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  expect(mockBack).not.toHaveBeenCalled();
  const botones = (Alert.alert as jest.Mock).mock.calls[0][2];
  botones[0].onPress();
  expect(mockBack).toHaveBeenCalled();
});
