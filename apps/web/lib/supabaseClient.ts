"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Browser Supabase client — used only for auth (register/login/session).
 * All application data goes through the NestJS API (see lib/api.ts).
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const isSupabaseConfigured =
  url.length > 0 && anonKey.length > 0 && anonKey !== "REPLACE_WITH_ANON_KEY";
