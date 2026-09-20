// D.11 · Codificar el tipo sin gastar color.
//
// Lo que estas pruebas protegen no es el aspecto —eso se juzga en un
// dispositivo— sino las dos propiedades que hacen que el codigo CODIFIQUE algo:
// que los tres tipos tengan tres tratamientos distintos, y que la trama nunca
// viaje sin su palabra.

import { render, screen } from '@testing-library/react-native';

import { Tramas } from '@/constants/theme';
import { SelloTipo, TRAMA_DE } from '../SelloTipo';

// LA prueba. Si dos tipos acabaran en la misma trama, el sello seguiria
// pintandose, seguiria viendose bien, y habria dejado de distinguir nada.
test('los tres tipos usan tres tramas distintas', () => {
  const usadas = Object.values(TRAMA_DE);
  expect(new Set(usadas).size).toBe(usadas.length);
});

test('las tres tramas son tres borderStyle distintos', () => {
  const estilos = Object.values(Tramas).map((t) => t.borderStyle);
  expect(new Set(estilos).size).toBe(estilos.length);
});

// Un patron sin leyenda es una clave que nadie tiene. Codificar informacion SOLO
// con un tratamiento visual falla para la misma gente para la que falla
// codificarla solo con color.
test('la trama nunca va sola: el tipo tambien va escrito', async () => {
  await render(<SelloTipo tipo="casa_compartida" />);
  expect(screen.getByText('CASA', { includeHiddenElements: true })).toBeTruthy();
});

test('cada tipo estampa su propia palabra', async () => {
  const vista = await render(<SelloTipo tipo="cuarto" />);
  expect(screen.getByText('CUARTO', { includeHiddenElements: true })).toBeTruthy();
  vista.unmount();
});

// En Android, `borderStyle` de guiones y puntos se degrada a linea continua en
// cuanto hay `borderRadius`: las tres tramas se volverian una sola sin que nada
// fallara. Por eso el sello es un rectangulo, y por eso esto se comprueba.
test('el sello no lleva borderRadius, o en Android no habria tramas', async () => {
  await render(<SelloTipo tipo="depa" />);
  const texto = screen.getByText('DEPA', { includeHiddenElements: true });
  const estilo = texto.parent?.props?.style;
  const aplanado = JSON.stringify(estilo ?? {});
  expect(aplanado).not.toContain('borderRadius');
});
