describe("devModuleImports", () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock("./dev.module");
  });

  it("does not load development routes in production", () => {
    jest.doMock("./dev.module", () => {
      throw new Error("DevModule must not be loaded in production");
    });

    const { devModuleImports } = require("./dev.imports") as typeof import("./dev.imports");

    expect(devModuleImports("production")).toEqual([]);
  });

  it("loads development routes outside production", () => {
    const { devModuleImports } = require("./dev.imports") as typeof import("./dev.imports");

    expect(devModuleImports("development").map((moduleRef) => moduleRef.name)).toEqual([
      "DevModule",
    ]);
  });
});
