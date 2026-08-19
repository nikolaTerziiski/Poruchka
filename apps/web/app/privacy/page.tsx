"use client";

import { useTr } from "@/lib/i18n";
import { LegalPage } from "@/components/LegalPage";

const M = {
  en: {
    back: "Back",
    title: "Privacy Policy",
    lastUpdated: "Last updated: 14 July 2026",
    draftNote:
      "Draft template — review with a legal advisor before launch. This describes what data Poruchka handles during the pilot.",
    intro:
      "This policy explains what personal data Poruchka collects, why, and your choices. We keep data to the minimum needed to run ordering reminders.",
    sections: [
      {
        heading: "What we collect",
        body: "• Account data: your email and restaurant name (via Supabase Auth).\n• Team data: names, roles, and the chat ID we receive when a team member links their Telegram account.\n• Operational data: suppliers, items, order plans, and order history you create.",
      },
      {
        heading: "How we use it",
        body: "To authenticate you, to send order reminders on the due day, to show your order calendar and history, and to keep the service working. We do not sell your data or use it for advertising.",
      },
      {
        heading: "Messaging channels",
        body: "Reminders are delivered through Telegram during the pilot. Messages you send through those channels are also subject to the channel provider's own privacy policy.",
      },
      {
        heading: "Storage and retention",
        body: "Data is stored in Supabase (Postgres). We keep it for as long as your restaurant uses Poruchka and delete it on request within a reasonable period.",
      },
      {
        heading: "Your rights",
        body: "You can access, correct, or delete your restaurant's data, and withdraw a team member's chat link at any time from the Team page. To request full deletion, contact us.",
      },
      {
        heading: "Contact",
        body: "Data questions or deletion requests: jockigog@gmail.com.",
      },
    ],
  },
  bg: {
    back: "Назад",
    title: "Политика за поверителност",
    lastUpdated: "Последна промяна: 14 юли 2026 г.",
    draftNote:
      "Чернова — прегледайте с юрист преди пускане. Документът описва какви данни обработва Poruchka по време на пилотния период.",
    intro:
      "Тази политика обяснява какви лични данни събира Poruchka, защо и какви са вашите възможности. Пазим минимума данни, нужен за напомнянията за поръчки.",
    sections: [
      {
        heading: "Какво събираме",
        body: "• Данни за профил: имейл и име на ресторанта (чрез Supabase Auth).\n• Данни за екипа: имена, роли и чат идентификатора, който получаваме, когато член на екипа свърже профила си в Telegram.\n• Оперативни данни: доставчици, артикули, планове за поръчки и история на поръчките, които създавате.",
      },
      {
        heading: "Как ги използваме",
        body: "За да влизате сигурно в профила си, да изпращаме напомняния в деня на поръчката, да показваме календара и историята на поръчките ви и да поддържаме услугата. Не продаваме данните ви и не ги използваме за реклама.",
      },
      {
        heading: "Чат канали",
        body: "Напомнянията се доставят чрез Telegram по време на пилотния период. Съобщенията, които изпращате през тези канали, се подчиняват и на политиката за поверителност на съответния доставчик.",
      },
      {
        heading: "Съхранение и срок на запазване",
        body: "Данните се съхраняват в Supabase (Postgres). Пазим ги, докато ресторантът ви използва Poruchka, и ги изтриваме при поискване в разумен срок.",
      },
      {
        heading: "Вашите права",
        body: "Можете да преглеждате, коригирате или изтривате данните на ресторанта си и да премахвате чат връзката на член от екипа по всяко време от страница „Екип“. За пълно изтриване се свържете с нас.",
      },
      {
        heading: "Контакт",
        body: "Въпроси за данните или заявки за изтриване: jockigog@gmail.com.",
      },
    ],
  },
} as const;

export default function PrivacyPage() {
  const t = useTr(M);
  return (
    <LegalPage
      title={t.title}
      lastUpdated={t.lastUpdated}
      draftNote={t.draftNote}
      intro={t.intro}
      sections={t.sections}
      backLabel={t.back}
    />
  );
}
