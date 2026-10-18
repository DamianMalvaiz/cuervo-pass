// El tipo de publicación sobre la foto · Cuervo 360.
//
// Hasta el 17/10/2026 se distinguía con tres BORDES: continuo (depa), de guiones (cuarto) y de puntos (casa
// compartida), un recurso del sistema de «documento oficial». Probado en un iPhone real, se veía mal. Ahora es
// una píldora limpia. Lo que sigue protegiéndose es lo que hace que el código CODIFIQUE algo: que los tres
// tipos tengan tres iconos DISTINTOS y que el icono nunca viaje sin su palabra. Un tipo que solo se distingue
// por un adorno es una clave sin leyenda, y falla para la misma gente a la que falla distinguir por color.

import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radios } from '@/constants/theme';
import { ICONO_DE, SelloTipo } from '../SelloTipo';

// LA prueba. Si dos tipos acabaran con el mismo icono, el sello seguiría pintándose, seguiría viéndose bien,
// y habría dejado de distinguir nada.
test('los tres tipos usan tres iconos distintos', () => {
  const usados = Object.values(ICONO_DE);
  expect(new Set(usados).size).toBe(usados.length);
});

test('el icono nunca va solo: el tipo también va escrito', async () => {
  await render(<SelloTipo tipo="casa_compartida" />);
  expect(screen.getByText('Casa', { includeHiddenElements: true })).toBeTruthy();
});

test.each([
  ['depa', 'Depa'],
  ['cuarto', 'Cuarto'],
  ['casa_compartida', 'Casa'],
] as const)('el tipo %s estampa «%s»', async (tipo, palabra) => {
  await render(<SelloTipo tipo={tipo} />);
  expect(screen.getByText(palabra, { includeHiddenElements: true })).toBeTruthy();
});

// Una píldora limpia: esquinas redondeadas del todo y ningún borde de guiones ni de puntos.
test('es una píldora: radio completo y sin borde punteado ni rayado', async () => {
  await render(<SelloTipo tipo="cuarto" />);
  const contenedor = screen.getByText('Cuarto', { includeHiddenElements: true }).parent!;
  const estilo = StyleSheet.flatten(contenedor.props.style) as Record<string, unknown>;
  expect(estilo.borderRadius).toBe(Radios.full);
  expect(estilo.borderStyle).not.toBe('dashed');
  expect(estilo.borderStyle).not.toBe('dotted');
});

// Va encima de una fotografía cualquiera: fondo OPACO, no translúcido. Sobre una foto clara un texto a media
// opacidad deja de leerse, y el par fondo/texto ya está medido por el verificador de contraste.
test('el fondo es opaco y del tema', async () => {
  await render(<SelloTipo tipo="depa" />);
  const contenedor = screen.getByText('Depa', { includeHiddenElements: true }).parent!;
  const estilo = StyleSheet.flatten(contenedor.props.style) as { backgroundColor?: string };
  expect(estilo.backgroundColor).toBe(Colors.light.background);
});

// El tipo ya viaja en la etiqueta accesible de la fila entera: aquí sobra, y repetirlo haría que el lector de
// pantalla dijera lo mismo dos veces.
test('queda fuera del lector de pantalla', async () => {
  await render(<SelloTipo tipo="depa" />);
  const contenedor = screen.getByText('Depa', { includeHiddenElements: true }).parent!;
  expect(contenedor.props.accessibilityElementsHidden).toBe(true);
});
