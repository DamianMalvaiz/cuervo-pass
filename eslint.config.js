// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
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
