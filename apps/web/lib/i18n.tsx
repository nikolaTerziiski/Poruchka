"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
// Type-only: pulling lib/api in at runtime would drag the Supabase client into
// every bundle that renders <LanguageProvider>, including the landing page.
import type { ApiError } from "./api";

export type Lang = "en" | "bg";
const STORAGE_KEY = "poruchka.lang";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangContextValue>({ lang: "bg", setLang: () => {} });

/** Wraps the app; holds the chosen language (persisted to localStorage). Default Bulgarian. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bg");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "bg") setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  // Keep <html lang> in step with the switcher so screen readers, spellcheck and
  // hyphenation follow the language actually on screen.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext).lang;
}

export function useSetLang(): (l: Lang) => void {
  return useContext(LangContext).setLang;
}

/** Pick the current language's slice from a {en, bg} message object.
 * EN/BG are independent generics so `as const` literals in each language don't
 * have to match each other; the returned union still exposes every shared key. */
export function useTr<EN, BG>(messages: { en: EN; bg: BG }): EN | BG {
  return useLang() === "en" ? messages.en : messages.bg;
}

/** Shared terms reused across pages (buttons, states). */
export const COMMON = {
  en: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    remove: "Remove",
    create: "Create",
    loading: "Loading…",
    saving: "Saving…",
    deleting: "Deleting…",
    working: "Working…",
    optional: "Optional",
    errorNetwork: "No connection to the server. Check your internet and try again.",
    errorServer: "Something went wrong on our side. Try again in a minute.",
    errorSession: "Your access has expired. Please log in again.",
    errorConflict: "Someone else has already changed this order. Reload the page.",
    signOut: "Sign out",
    copy: "Copy",
    copied: "Copied",
    close: "Close",
    login: "Login",
    register: "Register",
    email: "Email",
    password: "Password",
  },
  bg: {
    save: "Запази",
    cancel: "Отказ",
    delete: "Изтрий",
    edit: "Редактирай",
    add: "Добави",
    remove: "Премахни",
    create: "Създай",
    loading: "Зареждане…",
    saving: "Запазване…",
    deleting: "Изтриване…",
    // Style rule 5: verbal noun for an in-flight state — never "Моля изчакайте".
    working: "Обработване…",
    optional: "По избор",
    errorNetwork: "Няма връзка със сървъра. Проверете интернета и опитайте пак.",
    errorServer: "Нещо се обърка от наша страна. Опитайте отново след минута.",
    errorSession: "Достъпът ви изтече. Влезте отново, за да продължите.",
    errorConflict: "Някой друг вече промени тази поръчка. Презаредете страницата.",
    signOut: "Изход",
    copy: "Копирай",
    copied: "Копирано",
    close: "Затвори",
    login: "Вход",
    register: "Регистрация",
    email: "Имейл",
    password: "Парола",
  },
} as const;

export function useCommon() {
  return COMMON[useLang()];
}

/* ------------------------------------------------------------------ *
 * API error copy
 * ------------------------------------------------------------------ */

// Structural rather than `instanceof ApiError`, because lib/api is imported for
// its types only (see top of file). `name` is a literal string, so the check
// survives minification and duplicated module instances — and TypeScript still
// verifies the shape against the real class.
function asApiError(cause: unknown): ApiError | null {
  if (typeof cause !== "object" || cause === null) return null;
  const e = cause as Partial<ApiError>;
  return e.name === "ApiError" && typeof e.status === "number" ? (e as ApiError) : null;
}

/**
 * Turn a thrown value from `api()` into copy a Bulgarian kitchen manager can act
 * on. Never render `error.message` — it is an untranslated transport string.
 *
 *   401 / 403  → "Достъпът ви изтече…"        (session gone)
 *   409        → "Някой друг вече промени…"     (two phones, one order)
 *   5xx        → "Нещо се обърка от наша страна…"
 *   other 4xx  → `fallback`, the page's own localized message
 *
 * A page that means something else by 409 — suppliers and items use it for
 * "still in use" — must test the status itself BEFORE falling back to this.
 *   not an ApiError (offline / fetch TypeError) → "Няма връзка със сървъра…"
 *
 * Usage: `setError(apiErrorText(cause, lang, t.saveFailed))`
 */
export function apiErrorText(cause: unknown, lang: Lang, fallback: string): string {
  const c = COMMON[lang];
  const err = asApiError(cause);
  if (!err) return c.errorNetwork;
  if (err.status === 401 || err.status === 403) return c.errorSession;
  // Every ConflictException the API raises on an order means the run moved on
  // under the user — two staff on two phones. "Save failed" would not tell them
  // that reloading is the fix.
  if (err.status === 409) return c.errorConflict;
  if (err.status >= 500) return c.errorServer;
  return fallback;
}

/** Hook form of {@link apiErrorText}, so a page needn't also pull in `useLang`.
 *  `const errText = useApiError();` … `setError(errText(cause, t.saveFailed))` */
export function useApiError(): (cause: unknown, fallback: string) => string {
  const lang = useLang();
  return (cause, fallback) => apiErrorText(cause, lang, fallback);
}
