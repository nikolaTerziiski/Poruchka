import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  // Dev: allow the web admin origin. Restrict to PUBLIC_API_URL/allowlist for prod.
  app.enableCors({ origin: true });
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  Logger.log(`Poruchka API listening on http://localhost:${port}`, "Bootstrap");
}

void bootstrap();
