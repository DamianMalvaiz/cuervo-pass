import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text, StyleSheet } from 'react-native';

import { Radios } from '@/constants/theme';
import { FilaAjuste } from '../FilaAjuste';
import { GrupoAjustes } from '../GrupoAjustes';

// Cuervo 360 · los renglones de ajustes pasan a tarjetas agrupadas (17/10/2026): cada renglón lleva su icono
// dentro de un cuadro redondeado, la etiqueta en negrita y, a la derecha, un dato corto o el chevron. Los
// renglones se agrupan dentro de una tarjeta de bordes redondeados, separados por un filete.

describe('FilaAjuste', () => {
  it('muestra el dato corto de la derecha cuando lo hay', async () => {
    await render(<FilaAjuste icono="heart-outline" etiqueta="Favoritos" detalle="12" onPress={() => {}} />);
    expect(screen.getByText('Favoritos')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('el dato corto entra en la etiqueta accesible', async () => {
    await render(<FilaAjuste icono="heart-outline" etiqueta="Favoritos" detalle="12" onPress={() => {}} />);
    expect(screen.getByRole('button').props.accessibilityLabel).toBe('Favoritos, 12');
  });

  it('con descripción y dato, ambos van en la etiqueta accesible', async () => {
    await render(
      <FilaAjuste icono="eye-outline" etiqueta="Perfil" descripcion="Lo que ven" detalle="Público" onPress={() => {}} />
    );
    expect(screen.getByRole('button').props.accessibilityLabel).toBe('Perfil. Lo que ven, Público');
  });

  it('dispara onPress', async () => {
    const onPress = jest.fn();
    await render(<FilaAjuste icono="heart-outline" etiqueta="Favoritos" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });

  it('el icono va dentro de un cuadro redondeado', async () => {
    await render(<FilaAjuste icono="heart-outline" etiqueta="Favoritos" onPress={() => {}} />);
    // El primer hijo del renglón es el cuadro que envuelve al icono.
    const chip = screen.getByRole('button').children[0] as unknown as { props: { style: unknown } };
    const estilo = StyleSheet.flatten(chip.props.style as never) as Record<string, unknown>;
    expect(estilo.borderRadius).toBe(Radios.control);
    expect(estilo.width).toBeGreaterThanOrEqual(34);
  });
});

describe('GrupoAjustes', () => {
  it('pinta su título y sus renglones', async () => {
    await render(
      <GrupoAjustes titulo="Tu cuenta">
        <Text>UNO</Text>
        <Text>DOS</Text>
      </GrupoAjustes>
    );
    expect(screen.getByText('Tu cuenta')).toBeTruthy();
    expect(screen.getByText('UNO')).toBeTruthy();
    expect(screen.getByText('DOS')).toBeTruthy();
  });

  it('va en una tarjeta de esquinas redondeadas', async () => {
    await render(
      <GrupoAjustes>
        <Text>UNO</Text>
      </GrupoAjustes>
    );
    const tarjeta = screen.getByText('UNO').parent!;
    const estilo = StyleSheet.flatten(tarjeta.props.style) as Record<string, unknown>;
    expect(estilo.borderRadius).toBe(Radios.tarjeta);
  });

  it('separa con filete solo ENTRE renglones: n renglones, n-1 filetes', async () => {
    await render(
      <GrupoAjustes testID="grupo">
        <Text>UNO</Text>
        <Text>DOS</Text>
        <Text>TRES</Text>
      </GrupoAjustes>
    );
    expect(screen.getAllByTestId('filete-ajuste')).toHaveLength(2);
  });

  it('ignora los hijos nulos o falsos sin dejar filetes colgando', async () => {
    await render(
      <GrupoAjustes>
        <Text>UNO</Text>
        {null}
        {false}
      </GrupoAjustes>
    );
    expect(screen.queryAllByTestId('filete-ajuste')).toHaveLength(0);
  });
});
