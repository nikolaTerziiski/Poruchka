import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Bot } from "grammy";
import { NOTIFICATION_CHANNEL } from "./notification-channel.port";
import { TelegramChannel } from "./telegram/telegram.channel";
import { TelegramBotService } from "./telegram/telegram.bot.service";
import { TelegramOrderActionService } from "./telegram/telegram-order-action.service";

@Module({
  providers: [
    {
      provide: Bot,
      useFactory: (config: ConfigService) => {
        const token = config.get<string>("TELEGRAM_BOT_TOKEN");
        if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
        return new Bot(token);
      },
      inject: [ConfigService],
    },
    TelegramChannel,
    TelegramOrderActionService,
    { provide: NOTIFICATION_CHANNEL, useExisting: TelegramChannel },
    TelegramBotService,
  ],
  exports: [NOTIFICATION_CHANNEL, Bot],
})
export class ChannelsModule {}
