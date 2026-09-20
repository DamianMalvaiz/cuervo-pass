// La afinidad en el perfil de una PERSONA.
//
// `sugerencias_roomies` ordena la lista por afinidad semantica y la tarjeta la
// enseña; al abrir el perfil, el numero desaparecia. Estas pruebas fijan las
// dos mitades del arreglo: que aparezca, y que su AUSENCIA se explique en vez
// de pintarse como un hueco.

const mockPerfil = jest.fn();
const mockAfinidad = jest.fn();

jest.mock('@/services/usuarios.service', () => ({
  obtenerPerfilPublico: (...a: unknown[]) => mockPerfil(...a),
  obtenerAfinidadRoomie: (...a: unknown[]) => mockAfinidad(...a),
  reportarUsuario: jest.fn(),
}));
jest.mock('@/services/mensajes.service', () => ({ abrirConversacion: jest.fn() }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({
  useFotosFirmadas: () => ({ urls: new Map(), fallo: null }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ usuarioId: 'u2' }),
  Stack: { Screen: () => null },
}));

import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import PerfilRoomieScreen from '../[usuarioId]';

const persona = {
  id: 'u2',
  nombre_completo: 'Ana Prueba',
  nombre_usuario: 'ana',
  foto_url: null,
  biografia: null,
  mascotas: false,
  fuma: false,
  nivel_ruido: 'bajo',
  horario_predominante: 'nocturno',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPerfil.mockResolvedValue(persona);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
});
afterEach(() => jest.restoreAllMocks());

// LA prueba. El numero por el que tocaste la tarjeta tiene que seguir ahi.
test('el perfil muestra la afinidad, en su casilla', async () => {
  mockAfinidad.mockResolvedValue({ similitud: 0.87, nivel: 2 });
  await render(<PerfilRoomieScreen />);
  // Medios puntos, la misma regla que END-30 fijo para toda la app.
  expect(await screen.findByText('8.5')).toBeTruthy();
  expect(screen.getByText('AFINIDAD')).toBeTruthy();
});

// La etiqueta dice AFINIDAD y no AJUSTE porque eso es: coseno puro. Entre
// personas no hay presupuesto ni distancia que ponderar, asi que llamarlo
// «ajuste» prometeria una mezcla que no existe.
test('la casilla se llama AFINIDAD, no AJUSTE', async () => {
  mockAfinidad.mockResolvedValue({ similitud: 0.87, nivel: 2 });
  await render(<PerfilRoomieScreen />);
  await screen.findByText('8.5');
  expect(screen.queryByText('AJUSTE')).toBeNull();
});

// Sin ficha de roomie no hay con que comparar. El campo se pinta —la casilla
// existe aunque el dato no— y la linea de abajo dice POR QUE esta vacia. Un
// guion solo invita a preguntar que falta.
test('sin afinidad, la casilla se pinta vacia y la linea explica por que', async () => {
  mockAfinidad.mockResolvedValue({ similitud: null, nivel: 1 });
  await render(<PerfilRoomieScreen />);
  expect(await screen.findByText(/no tiene ficha de roomie activa/)).toBeTruthy();
  expect(screen.getByText('—')).toBeTruthy();
});

// El dato ACCESORIO no puede tumbar al principal. Si la afinidad falla, la
// ficha se pinta igual: nombre, convivencia y el boton de chat siguen ahi.
test('si la afinidad falla, el perfil se pinta igual', async () => {
  mockAfinidad.mockRejectedValue(new Error('sin red'));
  await render(<PerfilRoomieScreen />);
  expect(await screen.findByText('Ana Prueba')).toBeTruthy();
  expect(screen.getByText('CONVIVENCIA')).toBeTruthy();
});
