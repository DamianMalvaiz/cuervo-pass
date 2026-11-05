import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

// El control táctil de toda la app. Lo que se fija: nunca se traga los eventos de quien lo usa (onPress, onPressIn, onPressOut), responde al toque con
// «reducir movimiento» encendido, apagado y aún sin saber, y no rompe el ref ni el resto de props (accesibilidad, deshabilitado).

let mockReducido: boolean | null = false;
jest.mock('@/hooks/use-movimiento-reducido', () => ({ useMovimientoReducido: () => mockReducido }));

import { Pulsable } from '../Pulsable';

const montar = async (props: Record<string, unknown> = {}) =>
  render(
    <Pulsable accessibilityLabel="Tocar" {...props}>
      <Text>contenido</Text>
    </Pulsable>
  );

describe.each([
  ['movimiento normal', false],
  ['reducir movimiento ENCENDIDO', true],
  ['todavía no se sabe (null)', null],
])('con %s', (_nombre, valor) => {
  beforeEach(() => { mockReducido = valor as boolean | null; });

  it('entrega onPress, onPressIn y onPressOut a quien lo usa', async () => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    await montar({ onPress, onPressIn, onPressOut });
    const control = screen.getByLabelText('Tocar');
    await fireEvent(control, 'pressIn');
    await fireEvent(control, 'pressOut');
    await fireEvent.press(control);
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('pulsar sin manejadores propios no rompe', async () => {
    await montar();
    const control = screen.getByLabelText('Tocar');
    await expect(fireEvent(control, 'pressIn')).resolves.not.toThrow();
    await expect(fireEvent(control, 'pressOut')).resolves.not.toThrow();
  });
});

test('un control deshabilitado no dispara onPress', async () => {
  mockReducido = false;
  const onPress = jest.fn();
  await montar({ onPress, disabled: true });
  await fireEvent.press(screen.getByLabelText('Tocar'));
  expect(onPress).not.toHaveBeenCalled();
});

test('conserva el rol y la etiqueta de accesibilidad que se le pasan', async () => {
  mockReducido = false;
  await montar({ accessibilityRole: 'button', accessibilityHint: 'Abre la ficha' });
  const control = screen.getByLabelText('Tocar');
  expect(control.props.accessibilityRole).toBe('button');
  expect(control.props.accessibilityHint).toBe('Abre la ficha');
});

test('pinta su contenido', async () => {
  mockReducido = false;
  await montar();
  expect(screen.getByText('contenido')).toBeTruthy();
});

// La opacidad animada parte de 1 y pisaba la del propio estilo: un control con `opacity: 0.45` (deshabilitado) volvía a verse activo. Ahora la que se
// anima se MULTIPLICA por la del estilo.
test('respeta la opacidad que trae su estilo (un control deshabilitado se sigue viendo deshabilitado)', async () => {
  mockReducido = false;
  await montar({ style: { opacity: 0.45 } });
  expect(StyleSheet.flatten(screen.getByLabelText('Tocar').props.style).opacity).toBeCloseTo(0.45);
});

test('sin opacidad propia en el estilo, parte de 1', async () => {
  mockReducido = false;
  await montar();
  expect(StyleSheet.flatten(screen.getByLabelText('Tocar').props.style).opacity).toBe(1);
});
