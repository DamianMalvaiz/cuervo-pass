import { fireEvent, render, screen } from '@testing-library/react-native';

// `/roomies`: la página de Roomies. Sin cuenta no hay perfiles reales que enseñar: lo que se ve es de qué trata y cómo se ve una tarjeta, marcada como ejemplo. Lo que se fija: dice la verdad (ejemplos, perfiles con cuenta) y lleva a entrar.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/use-tamano-pantalla', () => ({
  useTamanoPantalla: () => ({ clase: 'amplia', ancho: 1280, alto: 900, anchoContenido: 480, anchoLista: 800, altoApretado: false, escalaTitulo: 1 }),
}));

import Roomies from '../roomies';

beforeEach(() => jest.clearAllMocks());

test('tiene su barra con Roomies marcado y el pie', async () => {
  await render(<Roomies />);
  expect(screen.getByLabelText('Roomies').props['aria-current']).toBe('page');
  expect(screen.getByText(/Proyecto académico de la UTVT/)).toBeTruthy();
});

test('explica de qué trata y dice que los perfiles se ven con cuenta', async () => {
  await render(<Roomies />);
  expect(screen.getByText('Con quién vives importa tanto como dónde')).toBeTruthy();
  expect(screen.getByText(/se ven al iniciar sesión/)).toBeTruthy();
});

test('las personas son EJEMPLOS y lo dicen', async () => {
  await render(<Roomies />);
  expect(screen.getAllByText('Ejemplo')).toHaveLength(3);
});

test('el botón de la página lleva a entrar (aquí no hay otra página de roomies)', async () => {
  await render(<Roomies />);
  await fireEvent.press(screen.getByLabelText('Iniciar sesión para ver roomies'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
});

test('trae el bloque de confianza', async () => {
  await render(<Roomies />);
  expect(screen.getByText('Hecho para que confíes')).toBeTruthy();
});
