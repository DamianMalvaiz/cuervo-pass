// Preparación común de las pruebas de pantalla.
//
// Las pantallas montan componentes que leen el área segura del dispositivo
// (`PieFijo` usa `useSafeAreaInsets`). Fuera de un dispositivo no hay ningún
// valor que leer y la librería lanza en vez de devolver ceros, así que sin esto
// toda prueba de pantalla falla por un motivo que no tiene nada que ver con lo
// que se quiere comprobar.
// El mock que trae la libreria exporta por DEFECTO, no con nombres: sin el
// `.default` el modulo queda como { default: {...} } y `useSafeAreaInsets` no
// existe, con un error que no menciona nada de esto.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

// `react-native-reanimated` en pruebas.
//
// Sin doble, montar cualquier pantalla que lo importe revienta con "Cannot read
// properties of undefined (reading 'loadUnpackers')", un error que no menciona
// la animacion por ningun lado. Y el mock que trae la propia libreria tampoco
// sirve: arrastra `react-native-worklets`, que falla exactamente igual.
//
// Asi que el doble es de fabricacion propia y deliberadamente tonto: los
// componentes animados se vuelven Views normales y las animaciones de entrada
// no existen. Eso basta para lo que estas pruebas comprueban —que la pantalla
// MONTA y pinta su contenido— y no basta para nada sobre la animacion en si,
// que solo se puede juzgar en un dispositivo.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, ScrollView, Image } = require('react-native');
  const paso = () => ({ duration: () => paso(), delay: () => paso(), springify: () => paso(), damping: () => paso(), easing: () => paso() });
  return {
    __esModule: true,
    default: { View, Text, ScrollView, Image, createAnimatedComponent: (C) => C },
    View, Text, ScrollView, Image,
    createAnimatedComponent: (C) => C,
    FadeIn: paso(), FadeOut: paso(), FadeInDown: paso(), FadeInUp: paso(), FadeOutUp: paso(),
    SlideInRight: paso(), SlideOutLeft: paso(), Layout: paso(), LinearTransition: paso(),
    // `.get()` y `.set()` son la forma de Reanimated 4 compatible con el compilador de React, que no deja
    // modificar `.value` desde un manejador; el doble debe conocerlos igual que a `.value`.
    useSharedValue: (v) => {
      const o = { value: v };
      o.get = () => o.value;
      o.set = (x) => { o.value = typeof x === 'function' ? x(o.value) : x; };
      return o;
    },
    useAnimatedStyle: (fn) => (typeof fn === 'function' ? fn() : {}),
    withTiming: (v) => v, withSpring: (v) => v, withDelay: (_, v) => v,
    // El pulso de los esqueletos (END-38). `withRepeat` devuelve su valor para
    // que `useAnimatedStyle` siga produciendo un estilo valido, y se expone como
    // jest.fn() porque hay una prueba que comprueba que NO se llama cuando el
    // sistema pide reducir el movimiento — ahi lo que importa es la llamada, no
    // el valor.
    withRepeat: jest.fn((v) => v),
    // `out` y `cubic` son los del conteo de la cifra (END-37). `out(cubic)` se
    // devuelve DE VERDAD y no como identidad: la prueba del conteo comprueba que
    // el numero intermedio va por delante del lineal, que es lo que significa
    // «arranca rapido y frena al final». Con una identidad esa prueba pasaria
    // sin comprobar nada.
    Easing: {
      inOut: (f) => f,
      out: (f) => (t) => 1 - f(1 - t),
      cubic: (t) => t * t * t,
      ease: (t) => t,
      linear: (t) => t,
      bezier: () => (t) => t,
    },
    useAnimatedScrollHandler: () => () => {},
    interpolate: (x) => x, Extrapolation: { CLAMP: 'clamp' },
    runOnJS: (fn) => fn,
  };
});

// `useCuentaRestringida` (0082) lee `usuarios` con react-query. Las pantallas que lo usan ya tenían sus pruebas, sin ese proveedor ni esa consulta:
// por omisión es `false` (cuenta normal). Las pruebas de la restricción lo cambian con `mockReturnValue(true)`; la del propio hook lo desactiva
// con `jest.unmock`.
jest.mock('@/hooks/queries/useCuentaRestringida', () => ({ useCuentaRestringida: jest.fn(() => false) }));

// `react-native-maps` es un módulo NATIVO: fuera de un dispositivo,
// `TurboModuleRegistry.getEnforcing('RNMapsAirModule')` lanza al importarlo, y
// tumba la suite entera de cualquier pantalla que lo use — aunque la prueba no
// mire el mapa.
//
// El doble pinta una View con su testID. Sirve para comprobar que la pantalla
// monta y que el mapa está donde debe; no dice nada sobre si el mapa se ve, que
// es justo lo que END-10 tiene abierto y solo se comprueba en un dispositivo.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Falso = (nombre) => {
    const C = ({ children, ...props }) =>
      React.createElement(View, { ...props, testID: props.testID ?? nombre }, children);
    C.displayName = nombre;
    return C;
  };
  const MapView = Falso('mapa');
  return {
    __esModule: true,
    default: MapView,
    MapView,
    Marker: Falso('marcador'),
    Callout: Falso('globo'),
    PROVIDER_GOOGLE: 'google',
  };
});

// AsyncStorage llega por el cliente de Supabase, que lo usa para persistir la
// sesión. Es nativo, así que fuera del dispositivo es null y revienta al
// importarse. La librería trae su propio doble.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Los runners de CI son bastante más lentos que una laptop, y bajo la
// instrumentación de cobertura un render que aquí tarda 200 ms allí puede tardar
// segundos. El timeout de 5 s por defecto de Jest convertía eso en fallos al
// azar — END-23. Una compuerta que falla sin motivo se acaba apagando, que es
// justo lo que el comentario de Trivy en ci.yml advierte.
jest.setTimeout(15000);

// V.7 · Soltar los clientes de react-query al terminar cada prueba.
//
// Esto NO es lo que arregló el cuelgue —conviene decirlo, porque parece que sí—.
// El cuelgue lo causaban los temporizadores de `gcTime` y `staleTime`, y se
// resolvió no programándolos: ver test-utils/consultas.ts.
//
// Esto libera memoria: vacía la caché y suelta los oyentes de foco y conexión
// que cada cliente instala. Con seis archivos creando clientes en cada prueba,
// sin esto la suite arrastra todas las respuestas de todas las pruebas hasta el
// final.
afterEach(() => {
  require('@pruebas/consultas').liberarClientesDePrueba();
});
