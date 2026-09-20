// END-36 · `MaxContentWidth = 800` estaba declarado en el corazon del sistema
// visual y tenia CERO usos en todo el codigo. La orden D.10 daba la alternativa
// de borrarlo —«un token muerto es peor que ningun token»—; se conserva porque
// el problema no era el token sino que nadie lo aplicaba. Estas aserciones son
// lo que impide que vuelva a quedarse sin consumidores en silencio.

// Sin un solo mock: se prueba `medidasDe`, que son las reglas sin React.
//
// Se intento probar el hook sustituyendo `useWindowDimensions`, y no se puede
// barato: reemplazar `react-native` entero deja a `constants/theme.ts` sin
// `Platform.select`, y esparcir el modulo real con `requireActual` dispara sus
// getters de deprecacion y tumba la suite. Ninguno de los dos errores menciona
// el mock. La salida no fue un mock mas listo: fue sacar la aritmetica de React.

import { MaxContentWidth } from '@/constants/theme';
import { medidasDe } from '../use-tamano-pantalla';

const en = (width: number, height = 900) => medidasDe(width, height);

test('en un telefono, la lista ocupa todo el ancho', () => {
  expect(en(390).anchoLista).toBe(390);
});

test('en una tableta, la lista se acota a MaxContentWidth', () => {
  expect(en(1200).anchoLista).toBe(MaxContentWidth);
});

// LA distincion. Son dos numeros distintos a proposito y es tentador
// «unificarlos»: un formulario se lee mejor a 480 porque una linea de sesenta
// caracteres es legible y una de ciento veinte no; un renglon con foto de 96 y
// tres columnas de 86 necesita mas sitio, y acotarlo a la medida del formulario
// dejaria las columnas apretadas justo donde sobra espacio.
test('el ancho de formulario y el de lista NO son el mismo numero', () => {
  const t = en(1200);
  expect(t.anchoContenido).toBe(480);
  expect(t.anchoLista).toBe(800);
  expect(t.anchoContenido).toBeLessThan(t.anchoLista);
});

// El acotado nunca ENSANCHA. Si `anchoLista` devolviera 800 en un telefono de
// 390, la lista se saldria de la pantalla por la derecha.
test('nunca devuelve mas ancho del que hay', () => {
  for (const ancho of [320, 360, 390, 430, 700, 800, 1200]) {
    expect(en(ancho).anchoLista).toBeLessThanOrEqual(ancho);
  }
});
