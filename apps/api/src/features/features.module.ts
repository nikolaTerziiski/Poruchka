import { Module } from "@nestjs/common";
import { ChannelsModule } from "../channels/channels.module";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { MeController } from "./me.controller";
import { SuppliersController } from "./suppliers.controller";
import { ItemsController } from "./items.controller";
import { TeamController } from "./team.controller";
import { RemindersController } from "./reminders.controller";
import { OrderRulesController } from "./order-rules.controller";
import { OrderRunsController } from "./order-runs.controller";
import { OrderRunsService } from "./order-runs.service";

@Module({
  imports: [ChannelsModule],
  controllers: [
    MeController,
    SuppliersController,
    ItemsController,
    OrderRulesController,
    OrderRunsController,
    TeamController,
    RemindersController,
  ],
  providers: [SupabaseAuthGuard, OrderRunsService],
  exports: [OrderRunsService],
})
export class FeaturesModule {}
