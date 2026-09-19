import { render, screen } from '@testing-library/react-native';

import { FichaCompacta } from '../FichaCompacta';

// END-31 · `FichaCompacta` reimplementaba la calificación a mano —su propia
// casilla, su propio `fontSize`, su propio `fontFamily`— en vez de usar
// `Calificacion`. Y sin la ETIQUETA: el número flotaba sin decir qué era.
//
// Dos implementaciones de la pieza central del sistema divergen el día que una
// de las dos se toca. Que la etiqueta faltara en una de ellas es la prueba de
// que ya habían divergido.

test('la calificacion lleva su etiqueta, no un numero suelto', async () => {
  await render(<FichaCompacta titulo="Depa" precio={2800} score={0.94} />);
  // AJUSTE y medios puntos desde END-30: la misma regla que la ficha grande,
  // que es el punto entero de haberlas unificado en un solo componente.
  expect(await screen.findByText('AJUSTE', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('9.5', {}, { timeout: 5000 })).toBeTruthy();
});

// La misma regla que la ficha grande: sin score no se inventa un número.
test('sin score muestra la casilla vacia, no un cero', async () => {
  await render(<FichaCompacta titulo="Depa" precio={2800} />);
  expect(await screen.findByText('—', {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.queryByText('0.0')).toBeNull();
});

// La misma escala sobre 10 en las dos fichas. Si divergieran, la misma
// publicación mostraría números distintos según dónde se mire.
test('usa la misma escala sobre 10 que la ficha grande', async () => {
  await render(<FichaCompacta titulo="Depa" precio={2800} score={0.5} />);
  expect(await screen.findByText('5.0', {}, { timeout: 5000 })).toBeTruthy();
});

test('sigue mostrando el precio formateado', async () => {
  await render(<FichaCompacta titulo="Depa" precio={2800} score={0.9} />);
  expect(await screen.findByText('$2,800', {}, { timeout: 5000 })).toBeTruthy();
});
