"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Supabase's new publishable key (sb_publishable_…) replaces the legacy anon key;
// fall back to the anon key name for older projects.
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

// createClient() throws synchronously on an empty or non-http URL/key, so the
// guard has to be computed BEFORE the client is built — otherwise a misconfigured
// deploy crashes at module scope and the friendly "not configured" banner in
// login/page.tsx and (app)/layout.tsx never gets a chance to render.
// Match supabase-js's own validation: it rejects non-http(s) URLs too.
const isValidUrl = /^https?:\/\//i.test(url) && !url.includes("<ref>");

export const isSupabaseConfigured =
  isValidUrl && anonKey.length > 0 && !anonKey.startsWith("REPLACE_");

/**
 * Browser Supabase client — used only for auth (register/login/session).
 * All application data goes through the NestJS API (see lib/api.ts).
 *
 * When the env vars are missing we hand back an inert placeholder client so the
 * app still boots and can explain itself. Session persistence and token refresh
 * are OFF on that branch: otherwise a refresh timer would poll the placeholder
 * host forever and write an auth entry into the user's localStorage.
 * Always gate UI actions on `isSupabaseConfigured` — never on this being null.
 */
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createClient("http://localhost:54321", "public-anon-key-placeholder", {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
