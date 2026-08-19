/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  moduleNameMapper: {
    "^@poruchka/shared$": "<rootDir>/../../../packages/shared/src",
  },
  moduleFileExtensions: ["ts", "js", "json"],
};
