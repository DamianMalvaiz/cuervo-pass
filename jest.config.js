// La configuración vive aquí y no en package.json solo por legibilidad: tiene
// comentarios, y un objeto JSON no los admite.
//
// Se usa `preset:` y NO un spread de `jest-expo/jest-preset`. Al intentar
// extenderlo con un spread para añadir una entrada a `transform`, las rutas
// internas del preset dejaron de resolverse y cuatro suites fallaron con
// «Jest failed to parse a file» — un error que no menciona el preset por
// ningún lado. Si algún día hace falta añadir un transformador, se hace con
// `transform` ADEMÁS de `preset`, no en lugar de él.
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '\\.css$': '<rootDir>/jest.cssMock.js',
    // V.7 · Ayudantes que solo existen para las pruebas. Viven fuera de `src/`
    // a proposito: no entran en el bundle ni en `collectCoverageFrom`.
    '^@pruebas/(.*)$': '<rootDir>/test-utils/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // END-22 · Sin esto, Jest solo instrumenta los archivos que ALGUN test
  // importa. Lo que no tiene pruebas no baja el porcentaje: desaparece del
  // calculo. Medido el 20/09/2026: la cobertura decia 66.9% sobre 65 archivos
  // de los 99 que tiene `src/`, y tres de los cuatro servicios —mensajes,
  // roomies, usuarios— no aparecian en el informe en absoluto.
  //
  // Un numero de cobertura que mejora al NO escribir pruebas es peor que no
  // tener numero: invita a creer que el sistema esta mas probado cuanto menos
  // se prueba.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
    // `types/` son declaraciones puras: no hay una sola linea que ejecutar, y
    // contarlas como cubiertas o sin cubrir es ruido en las dos direcciones.
    '!src/types/**',
  ],

  // END-22 · Trinquete. Los numeros NO son aspiracionales: son lo que la suite
  // cubre HOY, medido el 20/09/2026. Puestos por encima de lo real, el build
  // nace rojo y una compuerta que siempre esta roja se acaba apagando; puestos
  // muy por debajo, no comprueban nada.
  //
  // La regla es que solo SUBEN. Si un cambio baja la cobertura, falla — y esa
  // es toda la idea: no impedir que se escriba codigo sin pruebas, sino que
  // ocurra sin que nadie se entere.
  //
  // La orden pedia 70 % para `src/services`. Estaba al 3.7 %: solo se probaba
  // una de sus veintinueve funciones. Hoy son 64.6 % de sentencias y 72.7 % de
  // lineas — las lineas ya pasan el objetivo, las sentencias todavia no, y
  // queda escrito asi en vez de redondear hacia arriba.
  // OJO con el `global`: Jest SACA del grupo global los archivos que caen bajo
  // un umbral por ruta. Asi que este 65 % no es el de todo `src/` —que es
  // 69.75 %— sino el de todo MENOS los cinco grupos de abajo. Poner aqui el
  // numero de la suite entera hace que el build falle sin que nadie entienda
  // por que.
  //
  // Y cada numero de este bloque esta MEDIDO, no estimado: se sube el umbral a
  // 100, se lee el porcentaje real del mensaje de fallo y se fija justo por
  // debajo. El 49 que habia aqui llevaba dieciseis puntos de retraso sobre la
  // realidad (65.8 %), o sea que habia dejado de ser un trinquete: no habria
  // detectado perder un tercio de la cobertura del grupo.
  coverageThreshold: {
    global: { statements: 65, branches: 60, functions: 60, lines: 67 },
    './src/services/': { statements: 64, branches: 52, functions: 66, lines: 72 },
    './src/store/': { statements: 66, branches: 52, functions: 67, lines: 68 },
    // V.4 · La pantalla de chat estaba al 0 %. El umbral va justo por debajo de
    // lo conseguido, como los otros dos: es un trinquete, solo sube.
    './src/app/chat/': { statements: 80, branches: 66, functions: 80, lines: 86 },
    // V.5 cubrio `registro.tsx` y dejo la carpeta en 39 %. V.8 anadio login,
    // recuperar-contrasena y cuestionario-inicial: 89.81 %. El trinquete sube.
    './src/app/(auth)/': { statements: 89, branches: 70, functions: 86, lines: 91 },
    // V.8 · `publicacion/editar` estaba al 0 %. Es la ruta con mas piezas del
    // producto —formulario de dieciseis campos, subida con upsert, embedding y
    // geocoding— y era la unica sin red.
    './src/app/publicacion/editar/': { statements: 90, branches: 66, functions: 100, lines: 96 },
    // V.8 · Las cinco pestañas. Estaba en 34.87 % con dos pantallas probadas de
    // seis; ahora 71.02 % con `inicio`, `publicaciones` y `roomies` añadidas.
    // Lo que queda fuera es `chats.tsx`, `_layout.tsx` y la mitad no tocada de
    // `perfil.tsx` — anotado en la cola, no dado por cerrado.
    './src/app/(tabs)/': { statements: 70, branches: 61, functions: 60, lines: 71 },
  },
};
