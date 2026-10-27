import { fireEvent, render, screen } from '@testing-library/react-native';

// La barra fija de las fichas en teléfono: lo que cuesta (o el nombre) a la izquierda y, a la derecha, el único camino para escribir, que sin cuenta es entrar.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

import { BarraContactoWeb } from '../BarraContactoWeb';

beforeEach(() => jest.clearAllMocks());

describe('BarraContactoWeb', () => {
  it('con precio lo enseña con «al mes» y lleva a entrar', async () => {
    await render(<BarraContactoWeb precio={3006} />);
    expect(screen.getByText(/3,006/)).toBeTruthy();
    expect(screen.getByText(/al mes/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Iniciar sesión para escribir'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/login');
  });

  it('sin precio (un negocio) enseña su nombre y su detalle, y nunca un cero', async () => {
    await render(<BarraContactoWeb nombre="Tacos El Cuervo" detalle="Abierto ahora" />);
    expect(screen.getByText('Tacos El Cuervo')).toBeTruthy();
    expect(screen.getByText('Abierto ahora')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
    // Un negocio no recibe mensajes: el botón no promete escribir.
    expect(screen.queryByLabelText('Iniciar sesión para escribir')).toBeNull();
    expect(screen.getByLabelText('Entrar para ver la dirección exacta')).toBeTruthy();
  });

  it('es la navegación fija de abajo: se anuncia como región con nombre', async () => {
    await render(<BarraContactoWeb precio={1} />);
    expect(screen.getByLabelText('Contactar')).toBeTruthy();
  });
});
