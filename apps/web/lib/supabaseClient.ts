"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Supabase's new publishable key (sb_publishable_…) replaces the legacy anon key;
// fall back to the anon key name for older projects.
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const isSupabaseConfigured =
  url.length > 0 && anonKey.length > 0 && !anonKey.startsWith("REPLACE_");

/**
 * Browser Supabase client — used only for auth (register/login/session).
 * All application data goes through the NestJS API (see lib/api.ts).
 */
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
