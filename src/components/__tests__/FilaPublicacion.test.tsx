import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// El corazón tiene sus propias pruebas; aquí solo importa que la fila lo monte cuando recibe el id.
jest.mock('../BotonFavorito', () => ({
  BotonFavorito: ({ publicacionId }: { publicacionId: string }) => {
    const { Text } = require('react-native');
    return <Text>{`CORAZON:${publicacionId}`}</Text>;
  },
}));

import { ALTO_FILA, FilaPublicacion } from '../FilaPublicacion';

// END-33 · La densidad contradecía el posicionamiento.
//
// `FichaPublicacion` mide ~420–450 px: **una tarjeta y media por pantalla**. Y
// PRODUCT.md dice «Airbnb ordena por deseo […] esto ordena por AJUSTE». El
// ajuste se evalúa COMPARANDO, y comparar exige ver varias opciones a la vez.
// Una tarjeta y media por pantalla es la densidad de un catálogo de deseo, no
// la de una tabla de decisión.
//
// La fila mide ~132 px y pone las tres cifras en columnas de ancho fijo con
// `tabular-nums`, para que formen columna al recorrer la lista — que es lo que
// convierte una lista en una tabla comparable.

test('mide lo que un renglon de tabla, no lo que una tarjeta', () => {
  // El rango lo fija la orden D.4: por debajo no cabe una foto legible, por
  // encima se deja de comparar.
  expect(ALTO_FILA).toBeGreaterThanOrEqual(128);
  expect(ALTO_FILA).toBeLessThanOrEqual(140);
});

test('en una pantalla de telefono caben al menos cuatro', () => {
  // 800 px es el alto útil conservador de un teléfono de gama media una vez
  // descontados barra de estado, encabezado y pestañas.
  const utiles = 800;
  expect(Math.floor(utiles / (ALTO_FILA + 8))).toBeGreaterThanOrEqual(4);
});

test('muestra las tres columnas con su etiqueta', async () => {
  await render(
    <FilaPublicacion titulo="Depa cerca del campus" precio={2800} score={0.94} distanciaKm={1.24} />
  );
  expect(await screen.findByText('AJUSTE', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('RENTA', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('DISTANCIA', {}, { timeout: 5000 })).toBeTruthy();
});

test('las cifras usan la misma escala que la ficha grande', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} score={0.94} distanciaKm={1.24} />);
  // Medios puntos, como END-30 dejó establecido para toda la app.
  expect(await screen.findByText('9.5', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('$2,800', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('1.2 km', {}, { timeout: 5000 })).toBeTruthy();
});

// §17 · Una publicación cuyo geocoding falló se muestra SIN distancia, no
// desaparece. El campo sigue existiendo y dice que no hay dato.
test('sin distancia el campo sigue ahi y dice que no hay dato', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} score={0.9} distanciaKm={null} />);
  expect(await screen.findByText('DISTANCIA', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('—', {}, { timeout: 5000 })).toBeTruthy();
});

test('sin score no se inventa una calificacion', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} distanciaKm={1} />);
  expect(screen.queryByText('0.0')).toBeNull();
});

test('sin foto lo dice en vez de dejar un hueco', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} score={0.9} />);
  expect(await screen.findByLabelText(/sin fotografía/i, {}, { timeout: 5000 })).toBeTruthy();
});

// El título es lo que identifica la publicación al comparar; si se corta sin
// aviso, dos filas distintas se leen iguales.
test('el titulo se muestra completo hasta dos renglones', async () => {
  await render(<FilaPublicacion titulo="Departamento amueblado a diez minutos" precio={2800} score={0.9} />);
  const t = await screen.findByText('Departamento amueblado a diez minutos', {}, { timeout: 5000 });
  expect(t.props.numberOfLines).toBe(2);
});

// Cuervo 360 · el número de afinidad es un interno del motor y ya no se muestra. END-30 lo ponía como nota bajo las
// columnas («afinidad 0.87»); quien mira ve AJUSTE, RENTA y DISTANCIA, y la lista llega ordenada sola.
test('la fila no muestra la afinidad numérica', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} score={0.9} distanciaKm={1.2} />);
  await screen.findByText('AJUSTE', {}, { timeout: 5000 });
  expect(screen.queryByText(/afinidad/)).toBeNull();
});

// Reproducido en un Android real (17/10/2026): «DISTANCIA» y «0.2 km» salían
// cortados contra el borde derecho. Tres columnas de 86 pt más dos huecos suman
// 274, y en una pantalla de 360 pt a la derecha de la foto quedan ~240. Fijar
// el ancho a ojo para un teléfono es fijarlo contra los demás.
//
// La alineación entre filas no se pierde: con `flex: 1` y `minWidth: 0` las tres
// columnas se reparten el mismo ancho en TODAS las filas, que es lo que importa
// —lo que se evita es que el contenido ensanche una columna, y con base 0 no lo hace.
test('las tres columnas se reparten el ancho y no se salen de una pantalla de 360 pt', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} score={0.94} distanciaKm={1.24} />);

  for (const etiqueta of ['AJUSTE', 'RENTA', 'DISTANCIA']) {
    const columna = (await screen.findByText(etiqueta, {}, { timeout: 5000 })).parent!;
    const estilo = StyleSheet.flatten(columna.props.style);
    expect(estilo.width).toBeUndefined();
    expect(estilo.flex).toBe(1);
    expect(estilo.minWidth).toBe(0);
  }
});

// Cuervo 360 · Favoritos. La fila pinta el corazón solo si sabe de qué publicación es.
test('con el id de la publicación, la fila pinta el corazón de favoritos', async () => {
  await render(<FilaPublicacion publicacionId="p9" titulo="Depa" precio={2800} score={0.9} distanciaKm={1} />);
  expect(await screen.findByText('CORAZON:p9', {}, { timeout: 5000 })).toBeTruthy();
});

test('sin el id (una fila de solo lectura) no hay corazón', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} score={0.9} distanciaKm={1} />);
  await screen.findByText('AJUSTE', {}, { timeout: 5000 });
  expect(screen.queryByText(/CORAZON:/)).toBeNull();
});
