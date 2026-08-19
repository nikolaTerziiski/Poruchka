import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

const DEV_WEB_ORIGIN = "http://localhost:3002";

/**
 * Browser origins allowed to call the API. Set CORS_ORIGINS to a comma-separated
 * list (e.g. "https://app.poruchka.bg"). Outside production the local web admin
 * on :3002 is always allowed so `pnpm dev` needs no extra configuration.
 */
function resolveCorsOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (process.env.NODE_ENV === "production") return configured;
  return Array.from(new Set([DEV_WEB_ORIGIN, ...configured]));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const origins = resolveCorsOrigins();
  if (origins.length === 0) {
    Logger.warn(
      "CORS_ORIGINS is not set — no browser origin may call this API. Set it to the web admin URL.",
      "Bootstrap",
    );
  }
  app.enableCors({ origin: origins, methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"] });

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  Logger.log(`Poruchka API listening on http://localhost:${port}`, "Bootstrap");
  Logger.log(`CORS allowlist: ${origins.join(", ") || "(none)"}`, "Bootstrap");
}

void bootstrap();
