import { Module } from "@nestjs/common";
import { ChannelsModule } from "../channels/channels.module";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { MeController } from "./me.controller";
import { SuppliersController } from "./suppliers.controller";
import { ItemsController } from "./items.controller";
import { OrderRulesController } from "./order-rules.controller";
import { TeamController } from "./team.controller";
import { OrdersController } from "./orders.controller";
import { SettingsController } from "./settings.controller";
import { OrderLinkService } from "./order-link.service";
import {
  PublicOrderLinkController,
  OrderLinkAdminController,
} from "./order-link.controller";

@Module({
  imports: [ChannelsModule],
  controllers: [
    MeController,
    SuppliersController,
    ItemsController,
    OrderRulesController,
    TeamController,
    OrdersController,
    SettingsController,
    PublicOrderLinkController,
    OrderLinkAdminController,
  ],
  providers: [SupabaseAuthGuard, RolesGuard, OrderLinkService],
})
export class FeaturesModule {}
