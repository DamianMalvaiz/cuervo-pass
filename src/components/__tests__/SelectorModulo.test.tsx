import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SelectorModulo } from '../SelectorModulo';

// Cuervo 360 · Inicio reúne los módulos (hoy Depas y Roomies; Servicios llega en la Semana 2).
// El selector es lo que sustituye a las pestañas que se retiran del menú, así que tiene que
// decir en cuál estás sin depender del color, y tocarse con el pulgar.

test('muestra los tres módulos', async () => {
  await render(<SelectorModulo valor="depas" onCambiar={() => {}} />);
  expect(screen.getByRole('tab', { name: 'Depas' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Roomies' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Servicios' })).toBeTruthy();
});

test('tocar Servicios lo pide', async () => {
  const onCambiar = jest.fn();
  await render(<SelectorModulo valor="depas" onCambiar={onCambiar} />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Servicios' }));
  expect(onCambiar).toHaveBeenCalledWith('servicios');
});

test('marca el activo como seleccionado para el lector de pantalla', async () => {
  await render(<SelectorModulo valor="roomies" onCambiar={() => {}} />);
  expect(screen.getByRole('tab', { name: 'Roomies' }).props.accessibilityState?.selected).toBe(true);
  expect(screen.getByRole('tab', { name: 'Depas' }).props.accessibilityState?.selected).toBe(false);
});

test('tocar el otro módulo lo pide', async () => {
  const onCambiar = jest.fn();
  await render(<SelectorModulo valor="depas" onCambiar={onCambiar} />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Roomies' }));
  expect(onCambiar).toHaveBeenCalledWith('roomies');
});

test('tocar el que ya está activo no hace nada', async () => {
  const onCambiar = jest.fn();
  await render(<SelectorModulo valor="depas" onCambiar={onCambiar} />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Depas' }));
  expect(onCambiar).not.toHaveBeenCalled();
});

// El estado activo NO depende solo del color: cambia el relleno, el borde y el peso.
test('el activo se distingue por más de un tono', async () => {
  await render(<SelectorModulo valor="depas" onCambiar={() => {}} />);
  const activo = StyleSheet.flatten(screen.getByRole('tab', { name: 'Depas' }).props.style) as Record<string, unknown>;
  const inactivo = StyleSheet.flatten(screen.getByRole('tab', { name: 'Roomies' }).props.style) as Record<string, unknown>;
  expect(activo.backgroundColor).not.toEqual(inactivo.backgroundColor);
  expect(activo.borderColor).not.toEqual(inactivo.borderColor);
});

test('cada opción mide al menos 44 pt de alto', async () => {
  await render(<SelectorModulo valor="depas" onCambiar={() => {}} />);
  for (const nombre of ['Depas', 'Roomies', 'Servicios']) {
    const estilo = StyleSheet.flatten(screen.getByRole('tab', { name: nombre }).props.style) as { minHeight?: number };
    expect(estilo.minHeight).toBeGreaterThanOrEqual(44);
  }
});

// Probado en un teléfono real el 24/10/2026: con la campana en la misma fila, «Roomies» se partía en «Roomi / es» y «Servicios» en «Servici / os».
// Jest no mide el diseño, así que se fija lo que lo causaba: una etiqueta que PUEDE ocupar dos renglones. Una sola línea, que se encoge antes de partirse.
test('ninguna etiqueta puede partirse en dos renglones', async () => {
  await render(<SelectorModulo valor="depas" onCambiar={() => {}} />);
  for (const nombre of ['Depas', 'Roomies', 'Servicios']) {
    const texto = screen.getByText(nombre);
    expect(texto.props.numberOfLines).toBe(1);
    expect(texto.props.adjustsFontSizeToFit).toBe(true);
  }
});
