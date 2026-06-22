import type { Type } from "@nestjs/common";

export function devModuleImports(nodeEnv = process.env.NODE_ENV): Type<unknown>[] {
  if (nodeEnv === "production") return [];

  const { DevModule } = require("./dev.module") as typeof import("./dev.module");
  return [DevModule];
}
