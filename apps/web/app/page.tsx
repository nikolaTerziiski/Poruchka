"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Send,
  MessageCircle,
  ClipboardList,
  Bell,
  CheckCheck,
  CalendarDays,
  Repeat,
  Users,
} from "lucide-react";
import { Button } from "@/components/ds/Button";
import { ReminderBubble } from "@/components/ds/ReminderBubble";
import { useTr } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const M = {
  en: {
    login: "Login",
    register: "Register",
    eyebrow: "For restaurant owners",
    heroTitleLine1: "Never miss a",
    heroTitleLine2: "supplier order again",
    heroSubcopy:
      "Define each good once — item, supplier, schedule. On the due day the right person gets a chat message and confirms with one tap. Miss it, and Poruchka nudges until it's done.",
    startFree: "Start free",
    telegramLine: "Reminders over Telegram — free for the pilot. Viber coming next.",
    heroChat: "Pilot — Family Restaurant chat",
    item: "Pork Meat",
    supplier: "Metro",
    doneMessage: "Done ✓ Ordered 24kg from Metro.",
    howEyebrow: "How it works",
    howHeading: "Three steps, then it runs itself",
    step1Title: "Define each good once",
    step1Body:
      "Pork Meat from Metro, every Wednesday at 09:00. Set the item, supplier, schedule and who's responsible.",
    step2Title: "The right person gets pinged",
    step2Body:
      "On the due day they get a Telegram message: “Order Pork Meat from Metro today.” No app to open.",
    step3Title: "They tap Done",
    step3Body:
      "One tap confirms. If it's missed, Poruchka re-nudges hourly within quiet hours, then escalates.",
    benefit1Title: "See the whole week",
    benefit1Body:
      "An order calendar shows what's due, from which supplier, who owns it, and live status.",
    benefit2Title: "Any rhythm",
    benefit2Body:
      "Daily, specific weekdays, or every N days — each item on its own schedule.",
    benefit3Title: "Built for a team",
    benefit3Body:
      "Owner, managers and staff. Assign each order to the person who actually places it.",
    ctaHeading: "Set up your first reminder today",
    ctaSubtext: "Free for the pilot. No card required.",
    createRestaurant: "Create your restaurant",
    terms: "Terms",
    privacy: "Privacy",
    tagline: "поръчка · “order” in Bulgarian",
  },
  bg: {
    login: "Вход",
    register: "Регистрация",
    eyebrow: "За собственици на ресторанти",
    heroTitleLine1: "Никога не пропускайте",
    heroTitleLine2: "поръчка към доставчик",
    heroSubcopy:
      "Задайте всяка стока веднъж — артикул, доставчик, график. В деня на поръчката отговорникът получава съобщение в чата и потвърждава с едно докосване. Пропусне ли го, Poruchka напомня, докато не бъде свършено.",
    startFree: "Започнете безплатно",
    telegramLine: "Напомняния през Telegram — безплатно за пилота. Viber предстои.",
    heroChat: "Пилот — чат на Family Restaurant",
    item: "Свинско месо",
    supplier: "Metro",
    doneMessage: "Готово ✓ Поръчани 24 кг от Metro.",
    howEyebrow: "Как работи",
    howHeading: "Три стъпки и работи само",
    step1Title: "Задайте всяка стока веднъж",
    step1Body:
      "Свинско месо от Metro, всяка сряда в 09:00. Задайте артикула, доставчика, графика и кой е отговорен.",
    step2Title: "Точният човек получава напомняне",
    step2Body:
      "В деня на поръчката получава съобщение в Telegram: “Поръчай свинско месо от Metro днес.” Без отваряне на приложение.",
    step3Title: "Той докосва Готово",
    step3Body:
      "Едно докосване потвърждава. Ако се пропусне, Poruchka напомня на всеки час в рамките на работното време, след което ескалира.",
    benefit1Title: "Виждате цялата седмица",
    benefit1Body:
      "Календар на поръчките показва какво предстои, от кой доставчик, кой отговаря и статуса на живо.",
    benefit2Title: "Всякакъв ритъм",
    benefit2Body:
      "Ежедневно, в определени дни от седмицата или на всеки N дни — всеки артикул със собствен график.",
    benefit3Title: "Създадено за екип",
    benefit3Body:
      "Собственик, мениджъри и персонал. Възложете всяка поръчка на човека, който реално я прави.",
    ctaHeading: "Настройте първото си напомняне днес",
    ctaSubtext: "Безплатно за пилота. Без карта.",
    createRestaurant: "Създайте своя ресторант",
    terms: "Условия",
    privacy: "Поверителност",
    tagline: "поръчка · “order” на български",
  },
} as const;

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logomark.svg" width={32} height={32} alt="" />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 21, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>
        Poruchka
      </span>
    </div>
  );
}

function Step({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--brand-50)", border: "1px solid var(--brand-100)", color: "var(--brand-600)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)" }}>0{n}</span>
      </div>
      <h3 style={{ fontSize: 19, fontWeight: 700 }}>{title}</h3>
      <p style={{ fontSize: 15, color: "var(--text-body)", lineHeight: 1.6, margin: 0 }}>{children}</p>
    </div>
  );
}

function Benefit({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: 22, boxShadow: "var(--shadow-sm)" }}>
      <span style={{ color: "var(--brand-500)" }}>{icon}</span>
      <h4 style={{ fontSize: 16, fontWeight: 700, marginTop: 14 }}>{title}</h4>
      <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 6 }}>{children}</p>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const t = useTr(M);
  const [done, setDone] = useState(false);

  return (
    <div style={{ minHeight: "100%", background: "var(--surface-page)" }}>
      <style>{`
        .lp-hero { display:grid; grid-template-columns:1.05fr 0.95fr; gap:56px; align-items:center; max-width:1120px; margin:0 auto; padding:72px 24px 56px; }
        .lp-grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:40px; }
        .lp-benefits { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
        @media (max-width: 860px) {
          .lp-hero { grid-template-columns:1fr; gap:32px; padding:48px 20px 40px; }
          .lp-grid3, .lp-benefits { grid-template-columns:1fr; gap:24px; }
          .lp-hero h1 { font-size:40px !important; }
        }
      `}</style>

      {/* Navbar */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "color-mix(in srgb, var(--surface-page) 86%, transparent)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", height: 64, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo />
          <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>{t.login}</Button>
            <Button variant="primary" size="sm" onClick={() => router.push("/register")}>{t.register}</Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <div>
          <span className="eyebrow">{t.eyebrow}</span>
          <h1 style={{ fontSize: 52, lineHeight: 1.04, letterSpacing: "-0.03em", marginTop: 14 }}>
            {t.heroTitleLine1}<br />{t.heroTitleLine2}
          </h1>
          <p style={{ fontSize: 19, color: "var(--text-body)", lineHeight: 1.55, marginTop: 20, maxWidth: 460 }}>
            {t.heroSubcopy}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
            <Button variant="primary" size="lg" onClick={() => router.push("/register")} iconRight={<ArrowRight size={18} />}>{t.startFree}</Button>
            <Button variant="secondary" size="lg" onClick={() => router.push("/login")}>{t.login}</Button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22, fontSize: 13, color: "var(--text-muted)" }}>
            <Send size={15} color="var(--brand-500)" />
            {t.telegramLine}
          </div>
        </div>

        {/* Hero visual */}
        <div style={{ position: "relative", background: "linear-gradient(180deg, var(--warm-100), var(--warm-150))", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-2xl)", padding: "32px 28px", boxShadow: "var(--shadow-md)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, color: "var(--text-muted)", fontSize: 12 }}>
            <MessageCircle size={14} /> {t.heroChat}
          </div>
          <ReminderBubble item={t.item} supplier={t.supplier} time="09:00" confirmed={done} onConfirm={() => setDone(true)} />
          {done && (
            <div style={{ marginTop: 14, marginLeft: "auto", width: "fit-content", maxWidth: 280, background: "var(--brand-500)", color: "#fff", padding: "10px 14px", borderRadius: "16px 16px 4px 16px", fontSize: 14 }}>
              {t.doneMessage}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: "var(--surface-card)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "64px 24px" }}>
          <span className="eyebrow">{t.howEyebrow}</span>
          <h2 style={{ fontSize: 34, letterSpacing: "-0.02em", marginTop: 12, marginBottom: 44 }}>{t.howHeading}</h2>
          <div className="lp-grid3">
            <Step n={1} icon={<ClipboardList size={20} />} title={t.step1Title}>
              {t.step1Body}
            </Step>
            <Step n={2} icon={<Bell size={20} />} title={t.step2Title}>
              {t.step2Body}
            </Step>
            <Step n={3} icon={<CheckCheck size={20} />} title={t.step3Title}>
              {t.step3Body}
            </Step>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "64px 24px" }}>
        <div className="lp-benefits">
          <Benefit icon={<CalendarDays size={22} />} title={t.benefit1Title}>
            {t.benefit1Body}
          </Benefit>
          <Benefit icon={<Repeat size={22} />} title={t.benefit2Title}>
            {t.benefit2Body}
          </Benefit>
          <Benefit icon={<Users size={22} />} title={t.benefit3Title}>
            {t.benefit3Body}
          </Benefit>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 72px" }}>
        <div style={{ background: "var(--warm-900)", borderRadius: "var(--radius-2xl)", padding: "48px 44px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ color: "var(--warm-50)", fontSize: 30, letterSpacing: "-0.02em" }}>{t.ctaHeading}</h2>
            <p style={{ color: "var(--warm-300)", fontSize: 16, marginTop: 10 }}>{t.ctaSubtext}</p>
          </div>
          <Button variant="primary" size="lg" onClick={() => router.push("/register")} iconRight={<ArrowRight size={18} />}>{t.createRestaurant}</Button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-card)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <Logo />
          <div style={{ display: "flex", gap: 24, fontSize: 13, color: "var(--text-muted)" }}>
            <a href="#" style={{ color: "inherit" }}>{t.terms}</a>
            <a href="#" style={{ color: "inherit" }}>{t.privacy}</a>
            <span>{t.tagline}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
