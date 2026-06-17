import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { ChannelsModule } from "./channels/channels.module";
import { DevModule } from "./dev/dev.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    ChannelsModule,
    DevModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
