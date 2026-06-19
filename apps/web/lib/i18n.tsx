"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

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
    working: "Working…",
    optional: "Optional",
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
    working: "Моля изчакайте…",
    optional: "По избор",
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
