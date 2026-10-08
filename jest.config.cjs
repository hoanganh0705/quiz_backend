/**
 * Jest configuration for the backend suite.
 *
 * SWC performs the TypeScript transform instead of ts-jest. ts-jest requires
 * the TypeScript compiler API, which the TypeScript version this project pins
 * no longer exposes, so every suite would otherwise fail to run. SWC strips
 * types independently of the compiler and still emits the decorator metadata
 * that NestJS dependency injection relies on.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        sourceMaps: true,
        // The project tsconfig targets `nodenext`, but Jest executes
        // CommonJS, so modules are downlevelled here rather than inherited.
        module: {
          type: 'commonjs',
        },
        jsc: {
          target: 'es2022',
          keepClassNames: true,
          parser: {
            syntax: 'typescript',
            decorators: true,
            dynamicImport: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
