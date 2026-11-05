// La entrada de las pantallas de acceso se anima SOLO cuando el sistema no pidió reducir el movimiento. El estado «todavía no
// sé» (null) cuenta como «reducido»: sin eso, quien pidió no ver movimiento vería un destello al abrir (ver use-movimiento-reducido).
// El doble de Reanimated no anima nada; lo que se comprueba aquí es la DECISIÓN: si se le entrega una animación de entrada o no.

const mockReducido = jest.fn();
jest.mock('@/hooks/use-movimiento-reducido', () => ({ useMovimientoReducido: () => mockReducido() }));

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Entrada, FileteQueSeTraza, GolpeDeSello } from '../EntradaAuth';

beforeEach(() => jest.clearAllMocks());

describe('Entrada', () => {
  it('con movimiento permitido entrega una animación de entrada', async () => {
    mockReducido.mockReturnValue(false);
    await render(<Entrada orden={1} testID="e"><Text>hola</Text></Entrada>);
    expect(screen.getByTestId('e').props.entering).toBeDefined();
  });

  it.each([true, null])('con reducido=%s NO anima, pero muestra el contenido', async (valor) => {
    mockReducido.mockReturnValue(valor);
    await render(<Entrada orden={1} testID="e"><Text>hola</Text></Entrada>);
    expect(screen.getByTestId('e').props.entering).toBeUndefined();
    expect(screen.getByText('hola')).toBeTruthy();
  });
});

describe('GolpeDeSello y FileteQueSeTraza', () => {
  it('no esconden su contenido: el botón es tocable aunque la animación no corra', async () => {
    mockReducido.mockReturnValue(true);
    await render(<GolpeDeSello><Text>Entrar</Text></GolpeDeSello>);
    expect(screen.getByText('Entrar')).toBeTruthy();
  });

  it.each([false, true])('el filete monta sin lanzar (reducido=%s)', async (valor) => {
    mockReducido.mockReturnValue(valor);
    await expect(render(<FileteQueSeTraza />)).resolves.toBeDefined();
  });
});
