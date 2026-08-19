import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { ChannelsModule } from "./channels/channels.module";
import { DevModule } from "./dev/dev.module";
import { FeaturesModule } from "./features/features.module";
import { SchedulerModule } from "./scheduler/scheduler.module";
import { HealthController } from "./health.controller";

// The dev endpoints are unauthenticated and can mint Telegram link codes for any
// user — they must NEVER be reachable in production. They are only registered when
// ENABLE_DEV_ENDPOINTS is explicitly set to "true" (local pilot driving only).
const devImports = process.env.ENABLE_DEV_ENDPOINTS === "true" ? [DevModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    ChannelsModule,
    ...devImports,
    FeaturesModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
