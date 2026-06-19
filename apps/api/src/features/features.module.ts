import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { MeController } from "./me.controller";
import { SuppliersController } from "./suppliers.controller";
import { ItemsController } from "./items.controller";
import { SchedulesController } from "./schedules.controller";
import { TeamController } from "./team.controller";
import { RemindersController } from "./reminders.controller";

@Module({
  controllers: [
    MeController,
    SuppliersController,
    ItemsController,
    SchedulesController,
    TeamController,
    RemindersController,
  ],
  providers: [SupabaseAuthGuard],
})
export class FeaturesModule {}
