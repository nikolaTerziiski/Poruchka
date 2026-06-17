import { Module } from "@nestjs/common";
import { ChannelsModule } from "../channels/channels.module";
import { DevController } from "./dev.controller";

@Module({
  imports: [ChannelsModule],
  controllers: [DevController],
})
export class DevModule {}
