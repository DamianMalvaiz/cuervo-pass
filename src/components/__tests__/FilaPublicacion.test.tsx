import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// El corazón tiene sus propias pruebas; aquí solo importa que la tarjeta lo monte cuando recibe el id.
jest.mock('../BotonFavorito', () => ({
  BotonFavorito: ({ publicacionId }: { publicacionId: string }) => {
    const { Text } = require('react-native');
    return <Text>{`CORAZON:${publicacionId}`}</Text>;
  },
}));

import { AltoFotoTarjeta, Radios } from '@/constants/theme';
import { FilaPublicacion } from '../FilaPublicacion';

// Cuervo 360 · de renglón de tabla a tarjeta con foto grande (17/10/2026).
//
// END-33 la había hecho un renglón de 132 pt con tres columnas (AJUSTE · RENTA · DISTANCIA) para «comparar».
// Probada en un iPhone real se leía como un formulario y no como un mercado: demasiados números técnicos y
// poca foto. Ahora la foto manda; el precio y la distancia van en una línea, en lenguaje de persona. El orden
// de la lista sigue siendo el ajuste, solo que ya no se enseña como cifra.

test('la foto es grande y de esquinas redondeadas', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} />);
  const foto = (await screen.findByLabelText(/sin fotografía/i, {}, { timeout: 5000 })) as unknown as { props: { style: unknown } };
  const estilo = StyleSheet.flatten(foto.props.style as never) as Record<string, unknown>;
  expect(AltoFotoTarjeta).toBeGreaterThanOrEqual(180);
  expect(estilo.height).toBe(AltoFotoTarjeta);
  expect(estilo.borderRadius).toBe(Radios.tarjeta);
});

test('el precio va con «al mes» y la distancia en una sola línea', async () => {
  await render(<FilaPublicacion titulo="Depa cerca del campus" precio={2800} distanciaKm={1.24} />);
  expect(await screen.findByText('$2,800 al mes', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('a 1.2 km', {}, { timeout: 5000 })).toBeTruthy();
});

// §17 · Una publicación cuyo geocoding falló se muestra SIN distancia, no desaparece. Ya no hay columna que
// «diga que no hay dato»: simplemente no hay línea de distancia, y no se inventa un «—».
test('sin distancia la tarjeta sigue ahí y no inventa una', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} distanciaKm={null} />);
  expect(await screen.findByText('$2,800 al mes', {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.queryByText(/ km/)).toBeNull();
  expect(screen.queryByText('—')).toBeNull();
});

test('ya no hay columnas técnicas ni cifra de ajuste', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} distanciaKm={1.2} />);
  await screen.findByText('$2,800 al mes', {}, { timeout: 5000 });
  for (const etiqueta of ['AJUSTE', 'RENTA', 'DISTANCIA']) {
    expect(screen.queryByText(etiqueta)).toBeNull();
  }
  expect(screen.queryByText(/afinidad/)).toBeNull();
});

test('sin foto lo dice en vez de dejar un hueco', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} />);
  expect(await screen.findByLabelText(/sin fotografía/i, {}, { timeout: 5000 })).toBeTruthy();
});

// El título identifica la publicación; si se corta sin aviso, dos tarjetas distintas se leen iguales.
test('el título se muestra completo hasta dos renglones', async () => {
  await render(<FilaPublicacion titulo="Departamento amueblado a diez minutos" precio={2800} />);
  const t = await screen.findByText('Departamento amueblado a diez minutos', {}, { timeout: 5000 });
  expect(t.props.numberOfLines).toBe(2);
});

test('el tipo va como píldora sobre la foto', async () => {
  await render(<FilaPublicacion titulo="Depa" tipo="cuarto" precio={2800} />);
  expect(await screen.findByText('Cuarto', { includeHiddenElements: true }, { timeout: 5000 })).toBeTruthy();
});

// Quien recorre la lista con un lector de pantalla oye el tipo primero y luego lo que decide: título, renta y
// distancia. Sin cifra de ajuste.
test('la etiqueta accesible dice tipo, título, renta y distancia', async () => {
  await render(<FilaPublicacion titulo="Depa luminoso" tipo="depa" precio={2800} distanciaKm={1.2} />);
  const boton = await screen.findByRole('button', {}, { timeout: 5000 });
  expect(boton.props.accessibilityLabel).toBe('Departamento. Depa luminoso. Renta $2,800 al mes, a 1.2 km.');
});

test('sin distancia la etiqueta accesible no la menciona', async () => {
  await render(<FilaPublicacion titulo="Depa luminoso" precio={2800} />);
  const boton = await screen.findByRole('button', {}, { timeout: 5000 });
  expect(boton.props.accessibilityLabel).toBe('Depa luminoso. Renta $2,800 al mes.');
});

// Cuervo 360 · Favoritos. La tarjeta pinta el corazón solo si sabe de qué publicación es.
test('con el id de la publicación, la tarjeta pinta el corazón de favoritos', async () => {
  await render(<FilaPublicacion publicacionId="p9" titulo="Depa" precio={2800} distanciaKm={1} />);
  expect(await screen.findByText('CORAZON:p9', {}, { timeout: 5000 })).toBeTruthy();
});

test('sin el id (de solo lectura) no hay corazón', async () => {
  await render(<FilaPublicacion titulo="Depa" precio={2800} distanciaKm={1} />);
  await screen.findByText('$2,800 al mes', {}, { timeout: 5000 });
  expect(screen.queryByText(/CORAZON:/)).toBeNull();
});
