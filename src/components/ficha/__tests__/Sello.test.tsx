import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// El botón primario de la app. Lo que se fija: responde al toque como todo lo demás (pasa por `Pulsable`: escala y opacidad, y respeta «reducir
// movimiento»; antes solo bajaba la opacidad y se sentía distinto del resto), entrega su `onPress`, no dispara mientras carga o está deshabilitado, y un
// botón que no se puede tocar se SIGUE VIENDO así.

// `Pulsable` tiene sus propias pruebas. Aquí se dobla por un marcador que deja pasar las props, para comprobar QUE Sello lo usa y con qué.
jest.mock('../Pulsable', () => {
  const { Pressable } = require('react-native');
  return { Pulsable: (props: Record<string, unknown>) => <Pressable testID="pulsable" {...props} /> };
});

import { Colors } from '@/constants/theme';

import { Sello } from '../Sello';

describe('Sello', () => {
  it('pasa por Pulsable: la misma respuesta al toque que el resto de la app', async () => {
    await render(<Sello onPress={() => {}}>Entrar</Sello>);
    expect(screen.getByTestId('pulsable')).toBeTruthy();
  });

  it('entrega onPress', async () => {
    const onPress = jest.fn();
    await render(<Sello onPress={onPress}>Entrar</Sello>);
    await fireEvent.press(screen.getByLabelText('Entrar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('cargando NO dispara y se anuncia ocupado', async () => {
    const onPress = jest.fn();
    await render(<Sello onPress={onPress} cargando>Entrar</Sello>);
    const boton = screen.getByTestId('pulsable');
    await fireEvent.press(boton);
    expect(onPress).not.toHaveBeenCalled();
    expect(boton.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('deshabilitado NO dispara y se sigue VIENDO deshabilitado', async () => {
    const onPress = jest.fn();
    await render(<Sello onPress={onPress} deshabilitado>Entrar</Sello>);
    const boton = screen.getByTestId('pulsable');
    await fireEvent.press(boton);
    expect(onPress).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(boton.props.style).opacity).toBeCloseTo(0.45);
  });

  it('activo no baja la opacidad por su cuenta (de eso se encarga Pulsable al tocar)', async () => {
    await render(<Sello onPress={() => {}}>Entrar</Sello>);
    expect(StyleSheet.flatten(screen.getByTestId('pulsable').props.style).opacity).toBeUndefined();
  });

  it('la etiqueta de accesibilidad por omisión es el texto, y se puede cambiar', async () => {
    await render(<Sello onPress={() => {}} accessibilityLabel="Crear cuenta">Entrar</Sello>);
    expect(screen.getByLabelText('Crear cuenta')).toBeTruthy();
  });

  // Lo irreversible se ve irreversible: «Eliminar mi cuenta para siempre» no es el verde lima de cualquier botón.
  it('«peligro» lleva el rojo de error, con su texto de contraste', async () => {
    await render(<Sello variante="peligro" onPress={() => {}}>Eliminar</Sello>);
    const estilo = StyleSheet.flatten(screen.getByTestId('pulsable').props.style);
    expect(estilo.backgroundColor).toBe(Colors.light.error);
    expect(StyleSheet.flatten(screen.getByText('Eliminar').props.style).color).toBe(Colors.light.errorTexto);
  });

  it('el contorno lleva borde y el sello lleva relleno', async () => {
    await render(<Sello variante="contorno" onPress={() => {}}>Otro</Sello>);
    const estilo = StyleSheet.flatten(screen.getByTestId('pulsable').props.style);
    expect(estilo.borderWidth).toBeGreaterThan(0);
    expect(estilo.backgroundColor).toBe('transparent');
  });
});
