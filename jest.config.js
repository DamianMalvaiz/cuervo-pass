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
  // un umbral por ruta. Asi que este 48 % no es el de todo `src/` —que es
  // 51 %— sino el de todo MENOS services y store. Poner aqui el numero de la
  // suite entera hace que el build falle sin que nadie entienda por que.
  coverageThreshold: {
    global: { statements: 49, branches: 41, functions: 44, lines: 50 },
    './src/services/': { statements: 64, branches: 52, functions: 66, lines: 72 },
    './src/store/': { statements: 66, branches: 52, functions: 67, lines: 68 },
  },
};
