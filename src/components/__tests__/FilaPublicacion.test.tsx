import { render, screen } from '@testing-library/react-native';

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

// END-30 · La afinidad va como nota, NO como columna: no todas las filas la
// tienen —el nivel es por fila desde END-08— y una columna medio vacía se lee
// como un dato perdido en vez de como un dato ausente.
test('muestra la afinidad cuando la fila es de Nivel 2', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} score={0.9} similitud={0.87} />);
  expect(await screen.findByText('afinidad 0.87', {}, { timeout: 5000 })).toBeTruthy();
});

test('sin afinidad no deja una nota vacia', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} score={0.9} similitud={null} />);
  expect(screen.queryByText(/afinidad/)).toBeNull();
});

// La renta y la distancia NO se repiten en la nota: ya son columnas, y
// repetirlas gastaría el único renglón libre en decir dos veces lo mismo.
test('la nota no repite lo que ya dicen las columnas', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} score={0.9} distanciaKm={1.2} similitud={0.8} />);
  expect(screen.queryByText(/tu tope/)).toBeNull();
  expect(await screen.findByText('afinidad 0.80', {}, { timeout: 5000 })).toBeTruthy();
});
