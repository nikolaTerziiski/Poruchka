"use client";

import { supabase } from "./supabaseClient";

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL;
// Keep zero-config local dev working, but make a production build that forgot
// the variable fail loudly instead of dialling the customer's own machine.
const API_URL =
  RAW_API_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "");

/** False when the build shipped without NEXT_PUBLIC_API_URL. Surface a localized
 *  banner on this — never the raw Error below. */
export const isApiConfigured = API_URL.length > 0;

/**
 * A non-ok HTTP response.
 *
 * `message` is deliberately status-only and MUST stay that way: call sites used
 * to render `error.message` straight into the red banner, which leaked English
 * JSON at Bulgarian kitchen staff. The server's text lives on `detail`, which is
 * for `console.error` in development only and must never reach the screen.
 *
 * Translate this into user-facing copy with `apiErrorText()` from lib/i18n.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail?: string,
  ) {
    super(`API ${status}`);
    this.name = "ApiError";
  }
}

/** Reads the body once and pulls out a loggable message (class-validator sends an array). */
async function readDetail(res: Response): Promise<string | undefined> {
  try {
    const raw = await res.text();
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as { message?: unknown };
      const message = parsed?.message;
      if (Array.isArray(message)) return message.join("; ");
      if (typeof message === "string") return message;
      return raw;
    } catch {
      return raw;
    }
  } catch {
    return undefined;
  }
}

function send(path: string, options: RequestInit, token?: string): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

// Module-scoped so a burst of parallel 401s triggers exactly one bounce.
let bouncing = false;

/**
 * Thin fetch wrapper that attaches the Supabase access token as a Bearer
 * header. The NestJS API verifies it and resolves the caller's tenant.
 *
 * Throws `ApiError` for a non-ok response, or the raw fetch `TypeError` when the
 * network is down — `apiErrorText()` distinguishes the two.
 */
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!isApiConfigured) throw new Error("NEXT_PUBLIC_API_URL is not set");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  let res = await send(path, options, session?.access_token);

  // A 401 can just mean a rotated key or clock skew — try one forced refresh
  // before giving up on the session.
  if (res.status === 401 && session) {
    let refreshed: string | undefined;
    try {
      const { data } = await supabase.auth.refreshSession();
      refreshed = data.session?.access_token;
    } catch {
      /* fall through to the bounce below */
    }
    if (refreshed) res = await send(path, options, refreshed);
  }

  if (res.status === 401) {
    // Without this the user sits on a page that will never load, with no way
    // out other than guessing they should sign out.
    if (!bouncing && typeof window !== "undefined" && window.location.pathname !== "/login") {
      bouncing = true;
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore — we are leaving anyway */
      }
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(401);
  }

  if (!res.ok) {
    const detail = await readDetail(res);
    if (process.env.NODE_ENV !== "production") {
      console.error("API", res.status, path, detail ?? res.statusText);
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return (await res.json()) as T;
}
