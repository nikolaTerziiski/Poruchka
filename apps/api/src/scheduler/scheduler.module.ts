import { Module } from "@nestjs/common";
import { ChannelsModule } from "../channels/channels.module";
import { SchedulerService } from "./scheduler.service";

@Module({
  imports: [ChannelsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
