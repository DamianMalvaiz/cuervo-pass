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
  const paso = () => ({ duration: () => paso(), delay: () => paso(), springify: () => paso(), damping: () => paso() });
  return {
    __esModule: true,
    default: { View, Text, ScrollView, Image, createAnimatedComponent: (C) => C },
    View, Text, ScrollView, Image,
    createAnimatedComponent: (C) => C,
    FadeIn: paso(), FadeOut: paso(), FadeInDown: paso(), FadeInUp: paso(),
    SlideInRight: paso(), SlideOutLeft: paso(), Layout: paso(), LinearTransition: paso(),
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => (typeof fn === 'function' ? fn() : {}),
    withTiming: (v) => v, withSpring: (v) => v, withDelay: (_, v) => v,
    useAnimatedScrollHandler: () => () => {},
    interpolate: (x) => x, Extrapolation: { CLAMP: 'clamp' },
    runOnJS: (fn) => fn,
  };
});
