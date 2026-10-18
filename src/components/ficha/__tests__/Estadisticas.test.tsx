import { render, screen } from '@testing-library/react-native';

import { Estadisticas } from '../Estadisticas';

// Cuervo 360 · la tarjeta de Perfil lleva dos números a la vista (propuesta del 17/10/2026): cuántos favoritos y
// cuántas publicaciones. «Cargando» no es cero: mientras se consulta no se pinta una cifra.

test('pinta cada cifra con su etiqueta', async () => {
  await render(<Estadisticas datos={[{ etiqueta: 'Favoritos', valor: 12 }, { etiqueta: 'Publicaciones', valor: 1 }]} />);
  expect(screen.getByText('12')).toBeTruthy();
  expect(screen.getByText('Favoritos')).toBeTruthy();
  expect(screen.getByText('1')).toBeTruthy();
  expect(screen.getByText('Publicaciones')).toBeTruthy();
});

test('un cero real se pinta como 0', async () => {
  await render(<Estadisticas datos={[{ etiqueta: 'Favoritos', valor: 0 }]} />);
  expect(screen.getByText('0')).toBeTruthy();
});

test('sin valor (cargando o falló) no inventa un cero: pinta un guion', async () => {
  await render(<Estadisticas datos={[{ etiqueta: 'Favoritos', valor: null }]} />);
  expect(screen.queryByText('0')).toBeNull();
  expect(screen.getByText('—')).toBeTruthy();
});

test('cada cifra se lee junto a su etiqueta', async () => {
  await render(<Estadisticas datos={[{ etiqueta: 'Favoritos', valor: 12 }]} />);
  expect(screen.getByLabelText('12 Favoritos')).toBeTruthy();
});
