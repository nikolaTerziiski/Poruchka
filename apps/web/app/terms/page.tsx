"use client";

import { useTr } from "@/lib/i18n";
import { LegalPage } from "@/components/LegalPage";

const M = {
  en: {
    back: "Back",
    title: "Terms of Service",
    lastUpdated: "Last updated: 14 July 2026",
    draftNote:
      "Draft template — review with a legal advisor before launch. This describes how Poruchka is intended to be used during the pilot.",
    intro:
      "Poruchka is a supplier-ordering reminder tool for restaurants. By creating an account and using the service you agree to these terms.",
    sections: [
      {
        heading: "The service",
        body: "Poruchka lets a restaurant define recurring supplier orders and sends the responsible person a reminder on the due day via a chat channel (Telegram during the pilot). Reminders are a convenience, not a guarantee — you remain responsible for placing your orders.",
      },
      {
        heading: "Your account",
        body: "You are responsible for the accuracy of the data you enter, for the actions of the team members you invite, and for keeping your login credentials secure. You must have the right to add any supplier or contact details you store.",
      },
      {
        heading: "Acceptable use",
        body: "Do not use Poruchka to send unlawful, abusive, or unsolicited messages, or to attempt to access data belonging to another restaurant. We may suspend accounts that do.",
      },
      {
        heading: "Availability",
        body: "The service is provided \"as is\" during the pilot. We do not guarantee uninterrupted delivery of reminders and are not liable for orders missed due to outages, third-party messaging failures, or incorrect configuration.",
      },
      {
        heading: "Changes and termination",
        body: "We may update these terms and will note the date above. You can stop using the service and request deletion of your restaurant's data at any time.",
      },
      {
        heading: "Contact",
        body: "Questions about these terms: jockigog@gmail.com.",
      },
    ],
  },
  bg: {
    back: "Назад",
    title: "Общи условия",
    lastUpdated: "Последна промяна: 14 юли 2026 г.",
    draftNote:
      "Чернова — прегледайте с юрист преди пускане. Документът описва как Poruchka се използва по време на пилотния период.",
    intro:
      "Poruchka напомня на ресторантите кога да поръчат от доставчиците си. Със създаването на профил и използването на услугата приемате тези условия.",
    sections: [
      {
        heading: "Услугата",
        body: "Poruchka позволява на ресторант да дефинира повтарящи се поръчки към доставчици и изпраща на отговорния човек напомняне в деня на поръчката чрез чат канал (Telegram по време на пилотния период). Напомнянията са улеснение, а не гаранция — отговорността за подаване на поръчките остава ваша.",
      },
      {
        heading: "Вашият профил",
        body: "Вие отговаряте за точността на въведените данни, за действията на поканените членове на екипа и за сигурността на данните за вход. Трябва да имате право да съхранявате данните за доставчиците и контактите, които въвеждате.",
      },
      {
        heading: "Допустимо използване",
        body: "Не използвайте Poruchka за изпращане на незаконни, обидни или непоискани съобщения, нито за достъп до данни на друг ресторант. Можем да спрем профил, който нарушава тези правила.",
      },
      {
        heading: "Наличност на услугата",
        body: "Услугата се предоставя „както е“ по време на пилотния период. Не гарантираме непрекъснато доставяне на напомнянията и не носим отговорност за пропуснати поръчки поради прекъсвания, проблеми с чат каналите или неправилна настройка.",
      },
      {
        heading: "Промени и прекратяване",
        body: "Можем да актуализираме тези условия, като отбележим датата по-горе. Можете да спрете използването на услугата и да поискате изтриване на данните на вашия ресторант по всяко време.",
      },
      {
        heading: "Контакт",
        body: "Въпроси относно условията: jockigog@gmail.com.",
      },
    ],
  },
} as const;

export default function TermsPage() {
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
