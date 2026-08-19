"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Send,
  MessageCircle,
  ClipboardList,
  Bell,
  CheckCheck,
  Menu,
  X,
} from "lucide-react";
import { ReminderBubble } from "@/components/ds/ReminderBubble";
import { useTr } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const M = {
  en: {
    login: "Login",
    register: "Register",
    menu: "Menu",
    closeMenu: "Close menu",
    eyebrow: "For restaurant owners",
    heroTitle: "Never miss a supplier order again",
    heroSubcopy:
      "Define each good once — item, supplier, schedule. On the due day the right person gets a chat message and confirms with one tap. Miss it, and Poruchka nudges until it's done.",
    startFree: "Start free",
    telegramLine: "Reminders over Telegram — free for the pilot. Viber coming next.",
    heroChat: "Chat at Mehanata restaurant",
    item: "Pork Meat",
    supplier: "Metro",
    doneMessage: "Sent ✓ Ordered 24kg from Metro.",
    howEyebrow: "How it works",
    howHeading: "Three steps, then it runs itself",
    step1Title: "Define each good once",
    step1Body:
      "Pork Meat from Metro, every Wednesday at 09:00. Set the item, supplier, days and who's responsible.",
    step2Title: "The right person gets pinged",
    step2Body:
      "On the due day they get a Telegram message: “Order Pork Meat from Metro today.” No app to open.",
    step3Title: "They tap “Sent”",
    step3Body:
      "One tap confirms. If it's missed, Poruchka re-nudges hourly — never during quiet hours — then alerts the owner.",
    benefitsEyebrow: "What you get",
    benefitsHeading: "One view of the whole week",
    benefit1Title: "See the whole week",
    benefit1Body:
      "An order calendar shows what's due, from which supplier, who owns it, and live status.",
    benefit2Title: "Any rhythm",
    benefit2Body:
      "Daily, specific weekdays, or every N days — each item on its own plan.",
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
    menu: "Меню",
    closeMenu: "Затваряне на менюто",
    eyebrow: "За собственици на ресторанти",
    heroTitle: "Никога не пропускайте поръчка към доставчик",
    heroSubcopy:
      "Задайте всеки артикул веднъж — доставчик, дни и отговорник. В деня на поръчката отговорникът получава съобщение в чата и потвърждава с едно натискане. Ако пропусне, Poruchka напомня, докато поръчката не бъде направена.",
    startFree: "Започнете безплатно",
    telegramLine: "Напомняния в Telegram — безплатно през пилотния период. Viber предстои.",
    heroChat: "Чат на ресторант „Механата“",
    item: "свинско месо",
    supplier: "Метро",
    doneMessage: "Изпратена ✓ Поръчани 24 кг от Метро.",
    howEyebrow: "Как работи",
    howHeading: "Три стъпки и Poruchka работи сама",
    step1Title: "Задайте всеки артикул веднъж",
    step1Body:
      "Свинско месо от Метро, всяка сряда в 09:00. Задайте артикула, доставчика, дните и кой е отговорен.",
    step2Title: "Отговорникът получава напомняне",
    step2Body:
      "В деня на поръчката отговорникът получава съобщение в Telegram: „Поръчай свинско месо от Метро днес.“ Без да отваря приложение.",
    step3Title: "Натиска „Изпратена“",
    step3Body:
      "Едно натискане потвърждава. Ако поръчката се пропусне, Poruchka напомня на всеки час — но никога в тихите часове — и накрая уведомява собственика.",
    benefitsEyebrow: "Какво получавате",
    benefitsHeading: "Един поглед върху цялата седмица",
    benefit1Title: "Виждате цялата седмица",
    benefit1Body:
      "Календарът на поръчките показва какво предстои, от кой доставчик, кой отговаря и в какво състояние е всяка поръчка в момента.",
    benefit2Title: "Всякакъв ритъм",
    benefit2Body:
      "Ежедневно, в определени дни от седмицата или на всеки N дни — всеки артикул със свой план.",
    benefit3Title: "Създадено за екип",
    benefit3Body:
      "Собственик, мениджъри и персонал. Възложете всяка поръчка на човека, който реално я прави.",
    ctaHeading: "Настройте първото си напомняне днес",
    ctaSubtext: "Безплатно през пилотния период. Без карта.",
    createRestaurant: "Регистрирайте ресторанта си",
    terms: "Условия",
    privacy: "Поверителност",
    tagline: "поръчка · „order“ на български",
  },
} as const;

/* ---------------------------------------------------------------------------
 * NavLink — a navigation control that renders a real <a> (via next/link) while
 * wearing the design system's Button clothes.
 *
 * Every call to action on this page navigates, so it has to be a link and not a
 * <button onClick={router.push()}>: screen readers list links separately from
 * buttons, and middle-click / Ctrl+click / "copy link address" only work on an
 * anchor. `components/ds/Button` renders a <button> and has no `href` prop, and
 * that file is owned by another workstream, so the three variants this page
 * needs are re-expressed here from the same tokens. If Button ever grows an
 * `href` prop, delete this component and use it — the values below are copied
 * from Button.tsx and must be kept in step with it.
 *
 * Two details that are load-bearing:
 *  - base.css underlines every `a:hover`, which would underline the white label
 *    on the primary CTA, so textDecoration is pinned to "none".
 *  - the focus ring is an inline outline, not a box-shadow, because the filled
 *    variants set their own inline box-shadow and an inline declaration beats
 *    the global :focus-visible rule (the same reason Button.tsx does it).
 * ------------------------------------------------------------------------- */

type NavVariant = "primary" | "secondary" | "ghost";
type NavSize = "sm" | "lg";

const NAV_SIZE: Record<NavSize, CSSProperties> = {
  sm: { height: 32, padding: "0 12px", fontSize: "var(--text-sm)", gap: 6 },
  lg: { height: 48, padding: "0 22px", fontSize: "var(--text-base)", gap: 9 },
};

const NAV_PALETTE: Record<
  NavVariant,
  { base: CSSProperties; hover: CSSProperties; press: CSSProperties }
> = {
  primary: {
    base: { background: "var(--accent)", color: "var(--text-on-accent)", borderColor: "transparent", boxShadow: "var(--shadow-xs)" },
    hover: { background: "var(--accent-hover)" },
    press: { background: "var(--accent-active)" },
  },
  secondary: {
    base: { background: "var(--surface-card)", color: "var(--text-strong)", borderColor: "var(--border-default)", boxShadow: "var(--shadow-xs)" },
    hover: { background: "var(--surface-hover)", borderColor: "var(--border-strong)" },
    press: { background: "var(--surface-inset)" },
  },
  ghost: {
    base: { background: "transparent", color: "var(--text-body)", borderColor: "transparent", boxShadow: "none" },
    hover: { background: "var(--surface-hover)" },
    press: { background: "var(--surface-inset)" },
  },
};

function NavLink({
  href,
  variant = "primary",
  size = "sm",
  iconRight = null,
  className,
  style,
  onClick,
  children,
}: {
  href: string;
  variant?: NavVariant;
  size?: NavSize;
  iconRight?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const [focusRing, setFocusRing] = useState(false);
  const pal = NAV_PALETTE[variant];

  return (
    <Link
      href={href}
      className={className}
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
      onFocus={(e) => {
        let visible = true;
        try {
          visible = e.currentTarget.matches(":focus-visible");
        } catch {
          /* browser without :focus-visible — show the ring rather than hide it */
        }
        setFocusRing(visible);
      }}
      onBlur={() => {
        setFocusRing(false);
        setPress(false);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderStyle: "solid",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        lineHeight: 1,
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        textDecoration: "none",
        whiteSpace: "nowrap",
        userSelect: "none",
        touchAction: "manipulation",
        transition:
          "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
        transform: press ? "translateY(0.5px) scale(0.99)" : "none",
        ...NAV_SIZE[size],
        ...pal.base,
        ...(hover ? pal.hover : null),
        ...(press ? pal.press : null),
        ...(focusRing
          ? {
              outline: "2px solid var(--border-focus)",
              outlineOffset: 2,
              boxShadow: (pal.base.boxShadow as string | undefined) ?? "none",
            }
          : null),
        ...style,
      }}
    >
      {children}
      {iconRight ? <span style={{ display: "inline-flex", marginRight: -2 }}>{iconRight}</span> : null}
    </Link>
  );
}

/* `minWidth: 0` plus the ellipsis on the wordmark is a safety net, not a
 * design intent: it lets the logo be the flex item that gives way if a very
 * narrow phone (320px) cannot fit logo + Register + ☰ on one row, instead of
 * pushing the header past the viewport and reintroducing the sideways scroll. */
function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logomark.svg" width={32} height={32} alt="" style={{ flex: "none" }} />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "clamp(16px, 5vw, 21px)",
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
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
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>0{n}</span>
      </div>
      <h3 style={{ fontSize: 19, fontWeight: 700 }}>{title}</h3>
      <p style={{ fontSize: 15, color: "var(--text-body)", lineHeight: 1.6, margin: 0 }}>{children}</p>
    </div>
  );
}

/* A deliberately different shape from the three numbered steps above it: a
 * ruled two-column list, label left and copy right, no icons. The section used
 * to be a second three-up icon-card grid, which made the page read as two
 * interchangeable rows of cards — the template look AGENTS.md §8 warns about. */
function BenefitRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="lp-benefit-row">
      <dt style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-strong)" }}>
        {title}
      </dt>
      <dd style={{ margin: 0, fontSize: 15, color: "var(--text-body)", lineHeight: 1.65 }}>{children}</dd>
    </div>
  );
}

export default function LandingPage() {
  const t = useTr(M);
  const [done, setDone] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Escape closes the mobile sheet and hands focus back to the toggle — the
  // same contract as the app sidebar drawer (AGENTS.md §7).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Opening moves focus into the sheet, so a keyboard user is not left behind
  // the backdrop.
  useEffect(() => {
    if (!menuOpen) return;
    sheetRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [menuOpen]);

  // Rotating to landscape past the collapse breakpoint must not leave an
  // orphaned sheet floating over a desktop layout.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 861px)");
    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const closeMenu = () => {
    setMenuOpen(false);
    menuBtnRef.current?.focus();
  };

  return (
    <div style={{ minHeight: "100%", background: "var(--surface-page)" }}>
      <style>{`
        .lp-header-inner { max-width:1120px; margin:0 auto; height:64px; padding:0 24px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .lp-nav { display:flex; align-items:center; gap:8px; }
        .lp-nav-secondary { display:flex; align-items:center; gap:8px; }
        .lp-nav-menu { display:none; }
        .lp-menu-backdrop { position:fixed; inset:64px 0 0 0; z-index:var(--z-backdrop); border:none; padding:0; margin:0; background:rgba(34,30,24,0.42); cursor:pointer; }
        .lp-menu-sheet { position:fixed; top:64px; left:0; right:0; z-index:var(--z-drawer); display:flex; flex-direction:column; gap:12px; padding:16px; background:var(--surface-page); border-bottom:1px solid var(--border-subtle); box-shadow:var(--shadow-lg); }
        .lp-hero { display:grid; grid-template-columns:1.05fr 0.95fr; gap:56px; align-items:center; max-width:1120px; margin:0 auto; padding:72px 24px 56px; }
        .lp-hero-visual { padding:32px 28px; }
        .lp-grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:40px; }
        .lp-benefits { margin:0; border-top:1px solid var(--border-subtle); }
        .lp-benefit-row { display:grid; grid-template-columns:minmax(180px,260px) 1fr; gap:32px; align-items:baseline; padding:22px 0; border-bottom:1px solid var(--border-subtle); }
        .lp-cta { padding:48px 44px; }
        @media (max-width: 860px) {
          .lp-nav-secondary { display:none; }
          .lp-nav-menu { display:inline-flex; }
          .lp-header-inner { padding:0 16px; }
          .lp-hero { grid-template-columns:1fr; gap:32px; padding:48px 20px 40px; }
          .lp-hero > * { min-width:0; }
          .lp-hero-visual { padding:20px 16px; }
          .lp-grid3 { grid-template-columns:1fr; gap:24px; }
          .lp-benefit-row { grid-template-columns:1fr; gap:6px; padding:18px 0; }
          .lp-hero h1 { font-size:40px !important; }
        }
        @media (max-width: 520px) {
          .lp-cta { padding:28px 20px; }
        }
        @media (max-width: 400px) {
          .lp-header-inner { padding:0 12px; }
        }
      `}</style>

      {/* Navbar — opaque on purpose: the translucent + blur(8px) bar was
          glassmorphism, which AGENTS.md §8 puts on the avoid list. The 1px
          bottom border does the separating. */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "var(--surface-page)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="lp-header-inner">
          <Logo />
          <nav className="lp-nav">
            {/* Register stays visible at every width (AGENTS.md §7); the
                secondary controls collapse into the ☰ sheet below 860px. */}
            <div className="lp-nav-secondary">
              <LanguageSwitcher />
              <NavLink href="/login" variant="ghost" size="sm">{t.login}</NavLink>
            </div>
            <NavLink href="/register" variant="primary" size="sm">{t.register}</NavLink>
            <button
              ref={menuBtnRef}
              type="button"
              className="lp-nav-menu"
              aria-label={t.menu}
              aria-expanded={menuOpen}
              aria-controls="lp-menu"
              onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                border: "1px solid transparent",
                borderRadius: "var(--radius-md)",
                background: "transparent",
                color: "var(--text-strong)",
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </nav>
        </div>
      </header>

      {menuOpen && (
        <>
          <button type="button" className="lp-menu-backdrop" aria-label={t.closeMenu} onClick={closeMenu} />
          <div id="lp-menu" ref={sheetRef} className="lp-menu-sheet">
            <NavLink href="/login" variant="secondary" size="lg" style={{ width: "100%" }} onClick={() => setMenuOpen(false)}>
              {t.login}
            </NavLink>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <LanguageSwitcher />
            </div>
          </div>
        </>
      )}

      <main id="main">
        {/* Hero */}
        <section className="lp-hero">
          <div>
            <span className="eyebrow">{t.eyebrow}</span>
            {/* One string per language, balanced by CSS. The old hard-coded
                <br/> was tuned for the English wording and split the Bulgarian
                headline into four ragged lines. */}
            <h1 style={{ fontSize: "var(--text-4xl)", lineHeight: 1.04, letterSpacing: "-0.03em", marginTop: 14, textWrap: "balance", maxWidth: "20ch" }}>
              {t.heroTitle}
            </h1>
            <p style={{ fontSize: 19, color: "var(--text-body)", lineHeight: 1.55, marginTop: 20, maxWidth: 460 }}>
              {t.heroSubcopy}
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <NavLink href="/register" variant="primary" size="lg" iconRight={<ArrowRight size={18} />}>{t.startFree}</NavLink>
              <NavLink href="/login" variant="secondary" size="lg">{t.login}</NavLink>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22, fontSize: 13, color: "var(--text-muted)" }}>
              <Send size={15} color="var(--brand-500)" />
              {t.telegramLine}
            </div>
          </div>

          {/* Hero visual — flat sunken panel + 1px border, not a gradient. */}
          <div className="lp-hero-visual" style={{ position: "relative", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-2xl)", boxShadow: "var(--shadow-md)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, color: "var(--text-muted)", fontSize: 12 }}>
              <MessageCircle size={14} /> {t.heroChat}
            </div>
            <ReminderBubble item={t.item} supplier={t.supplier} time="09:00" confirmed={done} onConfirm={() => setDone(true)} />
            {done && (
              <div style={{ marginTop: 14, marginLeft: "auto", width: "fit-content", maxWidth: 280, background: "var(--accent)", color: "var(--text-on-accent)", padding: "10px 14px", borderRadius: "16px 16px 4px 16px", fontSize: 14 }}>
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
          <span className="eyebrow">{t.benefitsEyebrow}</span>
          <h2 style={{ fontSize: 34, letterSpacing: "-0.02em", marginTop: 12, marginBottom: 28 }}>{t.benefitsHeading}</h2>
          <dl className="lp-benefits">
            <BenefitRow title={t.benefit1Title}>{t.benefit1Body}</BenefitRow>
            <BenefitRow title={t.benefit2Title}>{t.benefit2Body}</BenefitRow>
            <BenefitRow title={t.benefit3Title}>{t.benefit3Body}</BenefitRow>
          </dl>
        </section>

        {/* CTA */}
        <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 72px" }}>
          <div className="lp-cta" style={{ background: "var(--warm-900)", borderRadius: "var(--radius-2xl)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ color: "var(--warm-50)", fontSize: 30, letterSpacing: "-0.02em" }}>{t.ctaHeading}</h2>
              <p style={{ color: "var(--warm-300)", fontSize: 16, marginTop: 10 }}>{t.ctaSubtext}</p>
            </div>
            {/* The one label on the page long enough to outgrow a 320px phone
                ("Регистрирайте ресторанта си" is 27 characters), so this CTA
                alone opts out of the nowrap single-line button shape. */}
            <NavLink
              href="/register"
              variant="primary"
              size="lg"
              iconRight={<ArrowRight size={18} />}
              style={{ whiteSpace: "normal", textAlign: "center", height: "auto", minHeight: 48, padding: "12px 22px" }}
            >
              {t.createRestaurant}
            </NavLink>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-card)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <Logo />
          <div style={{ display: "flex", gap: 24, fontSize: 13, color: "var(--text-muted)", flexWrap: "wrap" }}>
            {/* Underlined on purpose: these sit in the same muted row as the
                tagline, so without an underline nothing signals they are the
                legal pages the registration checkbox promises. */}
            <Link href="/terms" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>{t.terms}</Link>
            <Link href="/privacy" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>{t.privacy}</Link>
            <span>{t.tagline}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
