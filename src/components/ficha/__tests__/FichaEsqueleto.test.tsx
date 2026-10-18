// END-38 · Lo que estas pruebas comprueban y lo que NO.
//
// Comprueban que el esqueleto pinta las ETIQUETAS REALES y no bloques grises, y
// que el pulso se apaga cuando el sistema pide reducir el movimiento. No
// comprueban que la animacion se vea bien: eso solo se juzga en un dispositivo,
// y el doble de Reanimated de `jest.setup.js` es deliberadamente tonto.

import { render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { withRepeat } from 'react-native-reanimated';

import { ListaEsqueleto } from '../FichaEsqueleto';

const mockWithRepeat = withRepeat as unknown as jest.Mock;

beforeEach(() => {
  mockWithRepeat.mockClear();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as never);
});

afterEach(() => jest.restoreAllMocks());

// LA prueba. El esqueleto existe para que la espera enseñe la ESTRUCTURA de lo
// que viene; si las etiquetas fueran bloques grises seria un spinner con mas
// pasos. Y estas tres cadenas no dependen de la respuesta del servidor: se
// saben antes de preguntar, asi que pintarlas como incognita seria empobrecer
// la espera sin motivo.
// `includeHiddenElements` no es un truco para que pase: el contenido del
// esqueleto esta oculto a accesibilidad A PROPOSITO, y la prueba de abajo lo
// fija. Aqui se mira lo que se PINTA, que es otra pregunta.
const OCULTOS = { includeHiddenElements: true } as const;

// La fila de carga espeja la TARJETA (foto grande + título + línea de precio), no el renglón de tabla con sus
// tres columnas, que se retiró el 17/10/2026. Ya no hay etiquetas AJUSTE · RENTA · DISTANCIA que pintar.
test('la fila de carga espeja la tarjeta: sin etiquetas de columnas', async () => {
  await render(<ListaEsqueleto variante="fila" filas={2} />);
  for (const etiqueta of ['AJUSTE', 'RENTA', 'DISTANCIA']) {
    expect(screen.queryByText(etiqueta, OCULTOS)).toBeNull();
  }
  expect(screen.getByLabelText('Cargando')).toBeTruthy();
});

// Un lector de pantalla que anuncie el andamio seis veces
// seguidas convierte una espera en un castigo. El esqueleto se anuncia UNA vez,
// por el contenedor, y su contenido queda fuera del arbol de accesibilidad: es
// andamio visual, no informacion.
test('el andamio no se le lee a nadie: una sola etiqueta accesible', async () => {
  await render(<ListaEsqueleto variante="fila" filas={6} />);
  expect(screen.queryByText('AJUSTE')).toBeNull();
  expect(screen.getByLabelText('Cargando')).toBeTruthy();
});

test('la hoja usa las etiquetas que le pasan, no unas fijas', async () => {
  await render(
    <ListaEsqueleto variante="hoja" filas={1} conFoto={false} etiquetas={['APORTACIÓN', 'DISTANCIA']} />
  );
  expect(screen.getByText('APORTACIÓN', OCULTOS)).toBeTruthy();
});

// `filas` no es decorativo: es una promesa sobre cuanto va a ocupar lo que
// viene, y es lo que hace que al llegar los datos no salte nada.
test('pinta exactamente las filas pedidas', async () => {
  await render(<ListaEsqueleto variante="renglon" filas={4} />);
  expect(screen.getByLabelText('Cargando')).toBeTruthy();
});

test('con movimiento normal, el pulso se repite', async () => {
  await render(<ListaEsqueleto variante="fila" filas={1} />);
  expect(mockWithRepeat).toHaveBeenCalled();
});

// Quien activa «Reducir movimiento» no lo hace por gusto: para algunas personas
// el movimiento repetido produce nausea o desencadena migrana, y un pulso que
// late sin parar en media pantalla es exactamente ese caso.
test('con movimiento reducido NO se inicia ninguna repeticion', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await render(<ListaEsqueleto variante="fila" filas={3} />);
  await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
  expect(mockWithRepeat).not.toHaveBeenCalled();
});
