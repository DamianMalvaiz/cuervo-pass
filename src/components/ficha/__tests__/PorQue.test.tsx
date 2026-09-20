import { render, screen } from '@testing-library/react-native';

import { PorQue } from '../PorQue';

// END-30 · Una cifra sola pide que te fíes. Con sus razones al lado se puede
// discutir, que es lo que una recomendación honesta permite.

test('dice distancia, holgura de presupuesto y afinidad', async () => {
  await render(<PorQue distanciaKm={1.24} precio={2500} presupuestoMax={3000} similitud={0.87} />);
  expect(await screen.findByText('1.2 km · $500 bajo tu tope · afinidad 0.87', {}, { timeout: 5000 })).toBeTruthy();
});

// Sin Nivel 2 se OMITE, no se escribe «afinidad —». Un guion invita a preguntar
// qué falta; su ausencia no promete nada.
test('sin afinidad, omite ese termino en vez de dejar un hueco', async () => {
  await render(<PorQue distanciaKm={2} precio={2500} presupuestoMax={3000} similitud={null} />);
  const linea = await screen.findByText(/km/, {}, { timeout: 5000 });
  expect(linea).toBeTruthy();
  expect(screen.queryByText(/afinidad/)).toBeNull();
});

// El filtro duro admite hasta un 10% por encima del tope (migración 0015), así
// que «sobre tu tope» ocurre de verdad y hay que decirlo.
test('dice cuando el precio esta POR ENCIMA del tope', async () => {
  await render(<PorQue distanciaKm={1} precio={3200} presupuestoMax={3000} />);
  expect(await screen.findByText(/\$200 sobre tu tope/, {}, { timeout: 5000 })).toBeTruthy();
});

test('sin geocoding omite la distancia y no inventa un cero', async () => {
  await render(<PorQue distanciaKm={null} precio={2500} presupuestoMax={3000} />);
  expect(screen.queryByText(/km/)).toBeNull();
  expect(await screen.findByText(/bajo tu tope/, {}, { timeout: 5000 })).toBeTruthy();
});

// Sin nada que explicar, no se pinta una línea vacía.
test('sin ningun dato no renderiza nada', async () => {
  const { toJSON } = await render(<PorQue precio={2500} />);
  expect(toJSON()).toBeNull();
});
