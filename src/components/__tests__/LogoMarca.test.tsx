import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { LogoMarca } from '../LogoMarca';

// El logo de Cuervo 360 dentro de la app. Es una imagen con transparencia, así que se ve igual sobre el
// papel claro y sobre el carbón; y como es una imagen, el lector de pantalla necesita que le digan qué es.

test('se anuncia como «Cuervo 360» para el lector de pantalla', async () => {
  await render(<LogoMarca />);
  const logo = screen.getByLabelText('Cuervo 360');
  expect(logo.props.accessibilityRole).toBe('image');
});

test('mide 88 por omisión y es cuadrado', async () => {
  await render(<LogoMarca />);
  const e = StyleSheet.flatten(screen.getByLabelText('Cuervo 360').props.style) as { width: number; height: number };
  expect(e.width).toBe(88);
  expect(e.height).toBe(88);
});

test('acepta otro tamaño', async () => {
  await render(<LogoMarca tamano={120} />);
  const e = StyleSheet.flatten(screen.getByLabelText('Cuervo 360').props.style) as { width: number; height: number };
  expect(e.width).toBe(120);
  expect(e.height).toBe(120);
});
