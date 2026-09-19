import { render, screen } from '@testing-library/react-native';

import { FichaPublicacion } from '../FichaPublicacion';

test('muestra el precio formateado en su campo', async () => {
  await render(<FichaPublicacion titulo="Depa cerca del campus" precio={2800} direccion="San Mateo Atenco" />);
  expect(await screen.findByText('$2,800', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('RENTA MENSUAL', {}, { timeout: 5000 })).toBeTruthy();
});

test('muestra el título y la dirección', async () => {
  await render(<FichaPublicacion titulo="Depa cerca del campus" precio={2800} direccion="San Mateo Atenco" />);
  expect(await screen.findByText('Depa cerca del campus', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('San Mateo Atenco', {}, { timeout: 5000 })).toBeTruthy();
});

// §17: el geocoding pudo fallar y la publicación se muestra igual. En este mundo
// eso NO es omitir la línea: el campo sigue ahí y dice que no hay dato, como una
// casilla del formulario que nadie llenó. Un hueco se lee como un error de la
// app; "sin dato" se lee como información.
test('el campo de distancia existe y dice que no hay dato cuando falta', async () => {
  await render(<FichaPublicacion titulo="Depa" precio={2800} direccion="San Mateo Atenco" distanciaKm={null} />);
  expect(await screen.findByText('DISTANCIA', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('sin dato', {}, { timeout: 5000 })).toBeTruthy();
});

test('muestra la distancia cuando existe', async () => {
  await render(<FichaPublicacion titulo="Depa" precio={2800} direccion="San Mateo Atenco" distanciaKm={1.24} />);
  expect(await screen.findByText('1.2 km', {}, { timeout: 5000 })).toBeTruthy();
});

// El score del motor viene en [0,1] y se presenta como calificación sobre 10,
// que es la escala que un estudiante mexicano lee sin explicación.
test('presenta el score como calificación sobre 10', async () => {
  await render(<FichaPublicacion titulo="Depa" precio={2800} direccion="Calle 1" score={0.94} />);
  expect(await screen.findByText('AFINIDAD', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('9.4', {}, { timeout: 5000 })).toBeTruthy();
});

// Sin score no se inventa un número: la casilla se muestra vacía.
test('sin score la casilla de afinidad queda vacía, no en cero', async () => {
  await render(<FichaPublicacion titulo="Depa" precio={2800} direccion="Calle 1" />);
  expect(await screen.findByText('—', {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.queryByText('0.0')).toBeNull();
});

test('sin fotografía lo dice, en vez de dejar un rectángulo vacío', async () => {
  await render(<FichaPublicacion titulo="Depa" precio={2800} direccion="Calle 1" />);
  expect(await screen.findByText('SIN FOTOGRAFÍA', {}, { timeout: 5000 })).toBeTruthy();
});
