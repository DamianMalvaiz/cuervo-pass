import { render, screen } from '@testing-library/react-native';

import { Calificacion } from '../Calificacion';

// END-30 · «AFINIDAD 9.4» afirmaba más de lo que el motor calcula.
//
// Tres problemas apilados:
//
//   1. PRECISIÓN FABRICADA. El número es `0.6 × score + 0.4 × similitud`, una
//      mezcla ponderada de cuatro heurísticas normalizadas a mano. No tiene un
//      decimal de resolución: 8.7 y 8.6 son ruido entre sí. Presentarlo con un
//      decimal, en Archivo_900Black a 56 px, afirma una exactitud inexistente.
//   2. SIGNIFICADO FALSO: por el término de presupuesto, lo más barato siempre
//      gana. Un «9.4» no significa «excelente departamento»: significa barato
//      y cerca.
//   3. AUTORIDAD PRESTADA: una calificación de kardex es un número ganado y
//      auditable. La metáfora no decora el dato, le presta credibilidad que no
//      tiene, a alguien que elige dónde va a vivir sin haber visto el lugar.
//
// Los medios puntos responden al primero: veintiún valores posibles en vez de
// ciento uno, que es aproximadamente la resolución que el cálculo soporta.

test('redondea a medios puntos, no a decimas', async () => {
  await render(<Calificacion score={0.94} />);
  expect(screen.queryByText('9.4')).toBeNull();
  expect(await screen.findByText('9.5', {}, { timeout: 5000 })).toBeTruthy();
});

test('un valor que ya cae en medio punto no se mueve', async () => {
  await render(<Calificacion score={0.85} />);
  expect(await screen.findByText('8.5', {}, { timeout: 5000 })).toBeTruthy();
});

test('redondea hacia abajo cuando toca', async () => {
  await render(<Calificacion score={0.92} />);
  expect(await screen.findByText('9.0', {}, { timeout: 5000 })).toBeTruthy();
});

// «Afinidad» suena a compatibilidad medida entre personas. Lo que el motor
// calcula es cuánto encaja una publicación con los filtros que tú pusiste.
test('la etiqueta por omision es AJUSTE, no AFINIDAD', async () => {
  await render(<Calificacion score={0.9} />);
  expect(await screen.findByText('AJUSTE', {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.queryByText('AFINIDAD')).toBeNull();
});

test('sin score sigue sin inventarse un numero', async () => {
  await render(<Calificacion score={null} />);
  expect(await screen.findByText('—', {}, { timeout: 5000 })).toBeTruthy();
});

test('el limite superior se respeta', async () => {
  await render(<Calificacion score={1} />);
  expect(await screen.findByText('10.0', {}, { timeout: 5000 })).toBeTruthy();
});

test('la etiqueta accesible anuncia el valor redondeado', async () => {
  await render(<Calificacion score={0.94} />);
  expect(await screen.findByLabelText('ajuste 9.5 de 10', {}, { timeout: 5000 })).toBeTruthy();
});
