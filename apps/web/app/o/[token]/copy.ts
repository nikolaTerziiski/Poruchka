/** Shared copy + formatting for the public one-tap confirm page.
 *
 * Lives in its own module because the page is split across a server component
 * (renders the order) and a client component (owns the button), and both need
 * the same strings. Language comes from the tenant, never the browser: the
 * person tapping the link never opened the admin and has no stored preference.
 */

export type Lang = "bg" | "en";

export const M = {
  bg: {
    linkBadTitle: "Връзката не е валидна",
    linkBadBody:
      "Възможно е връзката да е изтекла или да е копирана непълно. Помолете отговорника да изпрати ново напомняне.",
    orderFrom: (supplier: string) => `Поръчка към ${supplier}`,
    forDate: "За дата",
    cutoff: "Краен час",
    confirm: "Изпратена",
    confirming: "Записване…",
    confirmHint: "Натиснете, след като подадете поръчката към доставчика.",
    doneTitle: "Записахме поръчката",
    doneBody: "Благодарим! Няма да получавате повече напомняния за нея.",
    alreadyTitle: "Вече е отбелязана",
    alreadyBody: "Някой вече потвърди тази поръчка.",
    closedTitle: "Поръчката е приключена",
    closedBody: "Тази поръчка вече не приема потвърждение.",
    failed: "Нещо се обърка. Опитайте отново след минута.",
    offline: "Няма връзка със сървъра. Проверете интернета и опитайте пак.",
    noQuantity: "—",
    statusSkipped: "Пропусната",
  },
  en: {
    linkBadTitle: "This link is not valid",
    linkBadBody:
      "It may have expired or been copied incompletely. Ask the manager to send a new reminder.",
    orderFrom: (supplier: string) => `Order from ${supplier}`,
    forDate: "Date",
    cutoff: "Cutoff",
    confirm: "Sent",
    confirming: "Saving…",
    confirmHint: "Tap once you have placed the order with the supplier.",
    doneTitle: "Order recorded",
    doneBody: "Thank you. You will not be reminded about it again.",
    alreadyTitle: "Already marked",
    alreadyBody: "Someone has already confirmed this order.",
    closedTitle: "Order closed",
    closedBody: "This order no longer accepts a confirmation.",
    failed: "Something went wrong. Try again in a minute.",
    offline: "No connection to the server. Check your internet and try again.",
    noQuantity: "—",
    statusSkipped: "Skipped",
  },
} as const;

export interface OrderView {
  orderRunId: string;
  restaurant: string;
  supplier: string;
  supplierContact: string | null;
  assignee: string;
  dueDate: string;
  cutoffTime: string | null;
  status: string;
  language: string;
  actionable: boolean;
  submittedAt: string | null;
  lines: Array<{ item: string; quantity: string | null; unit: string | null; note: string | null }>;
}

export function toLang(value: string | undefined): Lang {
  return value === "en" ? "en" : "bg";
}

/** "събота, 9 август" — built from the date parts so a UTC-midnight ISO date
 *  cannot roll backwards a day in a negative-offset timezone. */
export function formatDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
