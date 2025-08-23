/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      useESM: true
    }]
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@ally/uniqueness$": "<rootDir>/../uniqueness/src/factory.ts"
  },
  testMatch: [
    "<rootDir>/src/**/*.test.ts",
    "<rootDir>/tests/**/*.test.ts"
  ],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.d.ts"
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"]
};
