import { Module } from "@nestjs/common";
import { ChannelsModule } from "../channels/channels.module";
import { FeaturesModule } from "../features/features.module";
import { SchedulerService } from "./scheduler.service";

@Module({
  imports: [ChannelsModule, FeaturesModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
