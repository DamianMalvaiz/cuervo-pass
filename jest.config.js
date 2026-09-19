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
};
