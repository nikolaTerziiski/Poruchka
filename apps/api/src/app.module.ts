import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { ChannelsModule } from "./channels/channels.module";
import { devModuleImports } from "./dev/dev.imports";
import { FeaturesModule } from "./features/features.module";
import { SchedulerModule } from "./scheduler/scheduler.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    ChannelsModule,
    ...devModuleImports(),
    FeaturesModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
