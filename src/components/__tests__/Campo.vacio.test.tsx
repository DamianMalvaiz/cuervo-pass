import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Filete } from '@/constants/theme';
import { Campo } from '../Campo';

// Cuervo 360 · el campo vacío ya no lleva borde de guiones (17/10/2026). Probado en un iPhone real el discontinuo se
// veía mal, igual que el del tipo de publicación. Lo que distingue un campo vacío es el fondo tintado y el borde más
// claro, y eso se queda.

const estiloDe = (etiqueta: string) =>
  StyleSheet.flatten(screen.getByLabelText(etiqueta).props.style) as Record<string, unknown>;

test('un campo vacío con `punteado` NO pinta borde de guiones', async () => {
  await render(<Campo etiqueta="Sobre ti" punteado value="" onChangeText={() => {}} />);
  expect(estiloDe('Sobre ti').borderStyle).not.toBe('dashed');
  expect(estiloDe('Sobre ti').borderWidth).toBe(Filete.fino);
});

test('el estado vacío se distingue por el fondo y el borde, no por guiones', async () => {
  await render(<Campo etiqueta="Vacío" punteado value="" onChangeText={() => {}} />);
  const vacio = estiloDe('Vacío');
  await render(<Campo etiqueta="Lleno" punteado value="hola" onChangeText={() => {}} />);
  const lleno = estiloDe('Lleno');
  expect(vacio.backgroundColor).not.toEqual(lleno.backgroundColor);
  expect(vacio.borderColor).not.toEqual(lleno.borderColor);
});
