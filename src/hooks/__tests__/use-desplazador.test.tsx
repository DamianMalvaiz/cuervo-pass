// Scroll al primer error · el cálculo.
//
// El `ScrollView` es de cada pantalla y el formulario no puede moverlo. Este hook
// le da a la pantalla las tres piezas —el ref, el seguimiento del desplazamiento y
// «ir a este nodo»— y al formulario solo `alNodo`.
//
// Lo que se comprueba es la CUENTA, que es lo que puede estar mal sin que nada
// truene: la posición de un nodo se mide en la VENTANA, así que hay que restarle
// la del ScrollView y sumarle lo que ya se desplazó. Que el resultado sea el
// correcto en un teléfono real no se puede juzgar aquí.

import { act, renderHook } from '@testing-library/react-native';

const mockReducido = jest.fn();
jest.mock('@/hooks/use-movimiento-reducido', () => ({ useMovimientoReducido: () => mockReducido() }));

import { MARGEN_SUPERIOR, useDesplazador } from '../use-desplazador';

/** Un nodo cuya posición en la ventana es `y`. */
const nodoEn = (y: number) => ({
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, y, 100, 20),
});

const scrollEn = (y: number) => ({
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, y, 400, 700),
  scrollTo: jest.fn(),
});

beforeEach(() => {
  mockReducido.mockReturnValue(false);
});

const montar = async () => {
  const vista = await renderHook(() => useDesplazador());
  const scroll = scrollEn(100);
  // React llama a este callback al montar el ScrollView; aquí se llama a mano.
  vista.result.current.registrarScroll(scroll as never);
  return { vista, scroll };
};

test('desplaza hasta que el nodo quede MARGEN_SUPERIOR por debajo del borde de la vista', async () => {
  const { vista, scroll } = await montar();

  // El nodo está 500 por debajo del borde superior del ScrollView (600 - 100).
  vista.result.current.desplazador.alNodo(nodoEn(600) as never);

  expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 500 - MARGEN_SUPERIOR, animated: true });
});

// Sin sumar lo ya desplazado, un formulario scrolleado a la mitad llevaría la
// vista de vuelta al principio en lugar de al campo.
test('suma lo que ya se desplazó', async () => {
  const { vista, scroll } = await montar();
  await act(async () => {
    vista.result.current.onScroll({ nativeEvent: { contentOffset: { y: 300 } } } as never);
  });

  vista.result.current.desplazador.alNodo(nodoEn(600) as never);

  expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 300 + 500 - MARGEN_SUPERIOR, animated: true });
});

// Un campo ya visible, cerca del borde, daría un destino negativo.
test('nunca pide un desplazamiento negativo', async () => {
  const { vista, scroll } = await montar();

  vista.result.current.desplazador.alNodo(nodoEn(110) as never);

  expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
});

// Una animación ES movimiento, y quien pide reducirlo no lo hace por gusto.
test('con «reducir movimiento» el desplazamiento no se anima', async () => {
  mockReducido.mockReturnValue(true);
  const { vista, scroll } = await montar();

  vista.result.current.desplazador.alNodo(nodoEn(600) as never);

  expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 500 - MARGEN_SUPERIOR, animated: false });
});

// Mientras no se sabe la preferencia (`null`) se trata como «sí hay movimiento»,
// que es lo que hace el sistema por omisión; ver useMovimientoReducido.
test('si aún no se sabe la preferencia, se anima', async () => {
  mockReducido.mockReturnValue(null);
  const { vista, scroll } = await montar();

  vista.result.current.desplazador.alNodo(nodoEn(600) as never);

  expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 500 - MARGEN_SUPERIOR, animated: true });
});

// Cuando el ScrollView aún no está montado, o ya se desmontó, no hay a quién
// pedir nada. Un error aquí tumbaría el envío del formulario.
test('sin ScrollView montado no lanza ni hace nada', async () => {
  const vista = await renderHook(() => useDesplazador());
  expect(() => vista.result.current.desplazador.alNodo(nodoEn(600) as never)).not.toThrow();
});

// `alNodo` va en las dependencias de un efecto del formulario: si cambiara de
// identidad en cada render, el efecto se dispararía de nuevo con cada uno.
test('desplazador, onScroll y registrarScroll conservan su identidad entre renders', async () => {
  const vista = await renderHook(() => useDesplazador());
  const antes = {
    desplazador: vista.result.current.desplazador,
    onScroll: vista.result.current.onScroll,
    registrarScroll: vista.result.current.registrarScroll,
  };
  await vista.rerender({});
  expect(vista.result.current.desplazador).toBe(antes.desplazador);
  expect(vista.result.current.onScroll).toBe(antes.onScroll);
  expect(vista.result.current.registrarScroll).toBe(antes.registrarScroll);
});
