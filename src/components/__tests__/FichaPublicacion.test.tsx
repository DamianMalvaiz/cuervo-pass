import { render, screen } from '@testing-library/react-native';

import { FichaPublicacion } from '../FichaPublicacion';

test('muestra el precio formateado en su campo', async () => {
  await render(<FichaPublicacion titulo="Depa cerca del campus" precio={2800} direccion="San Mateo Atenco" />);
  expect(screen.getByText('$2,800')).toBeTruthy();
  expect(screen.getByText('RENTA MENSUAL')).toBeTruthy();
});

test('muestra el título y la dirección', async () => {
  await render(<FichaPublicacion titulo="Depa cerca del campus" precio={2800} direccion="San Mateo Atenco" />);
  expect(screen.getByText('Depa cerca del campus')).toBeTruthy();
  expect(screen.getByText('San Mateo Atenco')).toBeTruthy();
});

// §17: el geocoding pudo fallar y la publicación se muestra igual. En este mundo
// eso NO es omitir la línea: el campo sigue ahí y dice que no hay dato, como una
// casilla del formulario que nadie llenó. Un hueco se lee como un error de la
// app; "sin dato" se lee como información.
test('el campo de distancia existe y dice que no hay dato cuando falta', async () => {
  await render(<FichaPublicacion titulo="Depa" precio={2800} direccion="San Mateo Atenco" distanciaKm={null} />);
  expect(screen.getByText('DISTANCIA')).toBeTruthy();
  expect(screen.getByText('sin dato')).toBeTruthy();
});

test('muestra la distancia cuando existe', async () => {
  await render(<FichaPublicacion titulo="Depa" precio={2800} direccion="San Mateo Atenco" distanciaKm={1.24} />);
  expect(screen.getByText('1.2 km')).toBeTruthy();
});

// El score del motor viene en [0,1] y se presenta como calificación sobre 10,
// que es la escala que un estudiante mexicano lee sin explicación.
test('presenta el score como calificación sobre 10', async () => {
  await render(<FichaPublicacion titulo="Depa" precio={2800} direccion="Calle 1" score={0.94} />);
  expect(screen.getByText('AFINIDAD')).toBeTruthy();
  expect(screen.getByText('9.4')).toBeTruthy();
});

// Sin score no se inventa un número: la casilla se muestra vacía.
test('sin score la casilla de afinidad queda vacía, no en cero', async () => {
  await render(<FichaPublicacion titulo="Depa" precio={2800} direccion="Calle 1" />);
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.queryByText('0.0')).toBeNull();
});

test('sin fotografía lo dice, en vez de dejar un rectángulo vacío', async () => {
  await render(<FichaPublicacion titulo="Depa" precio={2800} direccion="Calle 1" />);
  expect(screen.getByText('SIN FOTOGRAFÍA')).toBeTruthy();
});
