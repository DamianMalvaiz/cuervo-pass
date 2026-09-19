// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // ── Invariante 7 · Tokens de diseño o nada · END-31 ──
    //
    // La regla es de AGENTS.md y hasta ahora vivía solo ahí, o sea que dependía
    // de que alguien la leyera. Aquí la aplica el linter: la deuda medida —29
    // apariciones en 19 archivos— no puede crecer, porque cada una nueva es un
    // error de lint.
    //
    // Los literales `#hex` no se prohíben por separado: hoy hay CERO en estos
    // directorios y `no-restricted-syntax` sobre una cadena requiere inspeccionar
    // su valor, lo que produce falsos positivos con cualquier `#` en un texto.
    // La regla de tokens los cubre en la práctica porque todo color sale del tema.
    files: ['src/components/**/*.tsx', 'src/components/**/*.ts', 'src/app/**/*.tsx', 'src/app/**/*.ts'],
    ignores: [
      // DOS excepciones, no tres. `themed-text.tsx` dejó de serlo: la escala se
      // movió a `Texto` en theme.ts y ahora ese componente es un consumidor
      // más. Era la única que existía por una limitación del sistema y no del
      // entorno, así que era la única que se podía eliminar en vez de nombrar.
      //
      // · Los dos layouts alimentan el tema de React Navigation, que exige
      //   valores crudos y no acepta tokens.
      'src/app/_layout.tsx',
      'src/app/(tabs)/_layout.tsx',
      // Las pruebas quedan fuera: no son interfaz.
      '**/__tests__/**',
    ],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Property[key.name='fontSize']",
          message: 'Invariante 7: usa un `type` de ThemedText, no fontSize. Si falta una escala, añádela a themed-text.tsx.',
        },
        {
          selector: "Property[key.name='fontFamily']",
          message: 'Invariante 7: usa un `type` de ThemedText, no fontFamily. La tipografía sale de Tipografia en theme.ts.',
        },
      ],
    },
  },
  {
    // Las pruebas juegan con otras reglas, y no por descuido.
    //
    // `jest.mock` se eleva por encima de los `import`, así que un doble solo
    // puede construir lo que necesita con `require()` dentro de su fábrica, y el
    // módulo bajo prueba tiene que importarse DESPUÉS de declarar los dobles.
    // Las dos cosas que el linter marca aquí son justo las que hacen que el
    // doble funcione.
    //
    // Se apagan solo en `__tests__` para que el aviso siga valiendo en el resto
    // del código, que es donde sí significa algo. Veinte avisos esperados
    // convierten el lint en ruido, y un lint ruidoso se deja de leer.
    files: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "jest.setup.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/first": "off",
    },
  },
]);
