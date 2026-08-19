"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { UserPlus, Send, Check, Link2, X, Trash2, Copy, Users } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";
import { Select } from "@/components/ds/Select";
import { Badge } from "@/components/ds/Badge";
import { Card } from "@/components/ds/Card";
import { EmptyState } from "@/components/ds/EmptyState";
import { Dialog } from "@/components/ds/Dialog";
import { PageHead } from "@/components/ds/PageHead";
import { api } from "@/lib/api";
import { useTr, useCommon, useLang, useApiError, type Lang } from "@/lib/i18n";

type Role = "OWNER" | "MANAGER" | "STAFF";

interface Member {
  id: string;
  name: string;
  role: Role;
  chatChannel: string;
  chatUserId: string | null;
}

interface LinkResponse {
  code: string;
  deepLink: string | null;
}

/** Same error surface as /suppliers — see the note there. Built on the raw red
 *  scale, not the order-status palette. */
const ERROR_BOX: CSSProperties = {
  padding: "11px 14px",
  border: "1px solid var(--red-100)",
  borderRadius: "var(--radius-md)",
  background: "var(--red-50)",
  color: "var(--red-700)",
  fontSize: 13,
  lineHeight: 1.5,
};

// "Персонал" stays over "Служител": it is gender-neutral, where "Служител" is
// masculine-marked. Keep this table and M.*.roleStaff in step — the badge and
// the role picker must never show two different words for the same role.
const ROLE_LABEL: Record<Lang, Record<Role, string>> = {
  en: { OWNER: "Owner", MANAGER: "Manager", STAFF: "Staff" },
  bg: { OWNER: "Собственик", MANAGER: "Мениджър", STAFF: "Персонал" },
};

const M = {
  en: {
    title: "Team",
    subtitle: "Who places orders, and how they get reminders",
    addPerson: "Add person",
    loadFailed: "We couldn't load your team. Please try again.",
    loadingTeam: "Loading team…",
    emptyTitle: "No one on the team yet",
    emptyDesc: "Add the people who place orders so they can receive reminders.",
    telegramConnected: "Telegram connected",
    telegramNotLinked: "Telegram not linked yet",
    connectTelegram: "Connect Telegram",
    unlink: "Unlink",
    unlinkFailed: "We couldn't unlink Telegram. Please try again.",
    removeAria: (name: string) => `Remove ${name}`,
    // Add person dialog
    addDialogTitle: "Add a person",
    addDialogDesc: "They'll receive reminders once you connect their Telegram.",
    addFailed: "We couldn't add the person. Please try again.",
    nameLabel: "Name",
    namePlaceholder: "e.g. Georgi Iliev",
    roleLabel: "Role",
    roleStaff: "Staff",
    roleManager: "Manager",
    roleOwner: "Owner",
    // Connect Telegram dialog
    connectTitle: (name: string) => `Connect ${name} to Telegram`,
    connectTitleFallback: "Connect to Telegram",
    done: "Done",
    connectInstructionA: (firstName: string) => `Ask ${firstName} to open this link in Telegram and tap`,
    connectInstructionStart: "Start",
    connectInstructionB: "— the bot links the chat automatically.",
    them: "them",
    creatingLink: "Creating link…",
    createLinkFailed: "We couldn't create the link. Please try again.",
    noBotConfigured: "The Telegram bot isn't configured yet, so there's no link to share.",
    // Unlink confirm dialog
    unlinkTitle: (name: string) => `Unlink ${name} from Telegram?`,
    unlinkTitleFallback: "Unlink from Telegram?",
    unlinkDesc: (name: string) =>
      `${name} will stop receiving reminders. To reconnect, you'll need to send a new link.`,
    unlinkAction: "Unlink",
    // Delete confirm dialog
    deleteTitle: (name: string) => `Remove ${name} from the team?`,
    deleteTitleFallback: "Remove from the team?",
    deleteDesc: "They'll stop receiving reminders. This can't be undone.",
    removeFailed: "We couldn't remove the person. Please try again.",
  },
  bg: {
    title: "Екип",
    // Rewritten around the pronoun: the old "как се свързвате с него" assumed
    // every member is male (terminology canon, style rule 2).
    subtitle: "Кой прави поръчките и как получава напомнянията",
    addPerson: "Добави човек",
    loadFailed: "Не успяхме да заредим екипа. Опитайте отново.",
    loadingTeam: "Зареждане на екипа…",
    emptyTitle: "Все още няма никого в екипа",
    emptyDesc: "Добавете хората, които правят поръчки, за да получават напомняния.",
    telegramConnected: "Telegram е свързан",
    telegramNotLinked: "Telegram все още не е свързан",
    connectTelegram: "Свържи Telegram",
    unlink: "Прекрати връзката",
    unlinkFailed: "Не успяхме да прекратим връзката с Telegram. Опитайте отново.",
    removeAria: (name: string) => `Премахни ${name}`,
    // Add person dialog
    addDialogTitle: "Добавяне на човек",
    addDialogDesc: "Ще получава напомняния, след като свържете профила в Telegram.",
    addFailed: "Не успяхме да добавим човека. Опитайте отново.",
    nameLabel: "Име",
    namePlaceholder: "напр. Георги Илиев",
    roleLabel: "Роля",
    roleStaff: "Персонал",
    roleManager: "Мениджър",
    roleOwner: "Собственик",
    // Connect Telegram dialog
    connectTitle: (name: string) => `Свързване на ${name} с Telegram`,
    connectTitleFallback: "Свързване с Telegram",
    done: "Готово",
    connectInstructionA: (firstName: string) => `Помолете ${firstName} да отвори този линк в Telegram и да натисне`,
    connectInstructionStart: "Старт",
    connectInstructionB: "— ботът автоматично свързва чата.",
    them: "този човек",
    creatingLink: "Създаване на линк…",
    createLinkFailed: "Не успяхме да създадем линк за свързване. Опитайте отново.",
    noBotConfigured: "Telegram ботът все още не е настроен, затова няма линк за споделяне.",
    // Unlink confirm dialog
    unlinkTitle: (name: string) => `Прекратяване на връзката с Telegram за ${name}?`,
    unlinkTitleFallback: "Прекратяване на връзката с Telegram?",
    // The server clears the link code together with the chat id, so the old
    // deep link is dead — the owner has to send a brand new one.
    unlinkDesc: (name: string) =>
      `${name} ще спре да получава напомняния. За да свържете профила отново, ще трябва да изпратите нов линк.`,
    unlinkAction: "Прекрати връзката",
    // Delete confirm dialog
    deleteTitle: (name: string) => `Премахване на ${name} от екипа?`,
    deleteTitleFallback: "Премахване от екипа?",
    deleteDesc: "Ще спре да получава напомняния. Това не може да бъде отменено.",
    removeFailed: "Не успяхме да премахнем човека. Опитайте отново.",
  },
} as const;

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export default function TeamPage() {
  const t = useTr(M);
  const c = useCommon();
  const lang = useLang();
  const errText = useApiError();
  const roleLabel = ROLE_LABEL[lang];
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  // Every error surface holds the raw thrown cause, not a translated string, so
  // the handlers close over nothing language-dependent (honest dependency
  // arrays) and a language switch re-translates a message already on screen.
  // With unlink routed through a dialog, this one is purely a load failure.
  const [loadError, setLoadError] = useState<unknown>(null);

  // Add person dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addRole, setAddRole] = useState<Role>("STAFF");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<unknown>(null);

  // Connect Telegram dialog
  const [connectTarget, setConnectTarget] = useState<Member | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectLink, setConnectLink] = useState<LinkResponse | null>(null);
  const [connectError, setConnectError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);

  // Unlink confirm dialog
  const [unlinkTarget, setUnlinkTarget] = useState<Member | null>(null);
  const [unlinkBusy, setUnlinkBusy] = useState(false);
  const [unlinkError, setUnlinkError] = useState<unknown>(null);

  // Delete confirm dialog
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api<Member[]>("/team");
      setMembers(data);
    } catch (e) {
      setLoadError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- Add person ----
  function openAdd() {
    setAddName("");
    setAddRole("STAFF");
    setAddError(null);
    setAddOpen(true);
  }

  async function confirmAdd() {
    if (!addName.trim()) return;
    setAddBusy(true);
    setAddError(null);
    try {
      await api<Member>("/team", {
        method: "POST",
        body: JSON.stringify({ name: addName.trim(), role: addRole }),
      });
      setAddOpen(false);
      await load();
    } catch (e) {
      setAddError(e);
    } finally {
      setAddBusy(false);
    }
  }

  // ---- Connect Telegram ----
  async function openConnect(member: Member) {
    setConnectTarget(member);
    setConnectLink(null);
    setConnectError(null);
    setCopied(false);
    setConnectLoading(true);
    try {
      const res = await api<LinkResponse>(`/team/${member.id}/telegram-link`, {
        method: "POST",
      });
      setConnectLink(res);
    } catch (e) {
      setConnectError(e);
    } finally {
      setConnectLoading(false);
    }
  }

  async function closeConnect() {
    setConnectTarget(null);
    setConnectLink(null);
    setConnectError(null);
    setCopied(false);
    await load();
  }

  async function copyLink() {
    if (!connectLink?.deepLink) return;
    try {
      await navigator.clipboard.writeText(connectLink.deepLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  // ---- Unlink ----
  // Confirmed, not instant: unlinking silently stops every reminder for that
  // person, which is more damaging than removing them outright.
  function openUnlink(member: Member) {
    setUnlinkTarget(member);
    setUnlinkError(null);
  }

  async function confirmUnlink() {
    if (!unlinkTarget) return;
    setUnlinkBusy(true);
    setUnlinkError(null);
    try {
      await api(`/team/${unlinkTarget.id}/unlink`, { method: "POST" });
      setUnlinkTarget(null);
      await load();
    } catch (e) {
      setUnlinkError(e);
    } finally {
      setUnlinkBusy(false);
    }
  }

  // ---- Delete ----
  function openDelete(member: Member) {
    setDeleteTarget(member);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api(`/team/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setDeleteError(e);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title={t.title}
        subtitle={t.subtitle}
        action={
          <Button variant="primary" icon={<UserPlus size={16} />} onClick={openAdd}>
            {t.addPerson}
          </Button>
        }
      />

      {loadError !== null ? (
        <div role="alert" style={{ ...ERROR_BOX, marginBottom: 18 }}>
          {errText(loadError, t.loadFailed)}
        </div>
      ) : null}

      {loading ? (
        <div
          aria-live="polite"
          style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}
        >
          {t.loadingTeam}
        </div>
      ) : members.length === 0 ? (
        <Card pad="none">
          <EmptyState
            icon={<Users size={22} />}
            title={t.emptyTitle}
            description={t.emptyDesc}
            action={
              <Button variant="primary" icon={<UserPlus size={16} />} onClick={openAdd}>
                {t.addPerson}
              </Button>
            }
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {members.map((m) => {
            const linked = m.chatUserId !== null;
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  // Wraps on a phone: without this the identity column collapses
                  // to 0px and the name paints over the Connect Telegram button.
                  flexWrap: "wrap",
                  gap: 16,
                  rowGap: 12,
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-xl)",
                  boxShadow: "var(--shadow-xs)",
                  padding: "16px 20px",
                }}
              >
                {/* Avatar + identity travel together, so the avatar never
                    orphans onto a line of its own. */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    flex: "1 1 220px",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "var(--radius-pill)",
                      background: "var(--brand-100)",
                      color: "var(--brand-700)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 600,
                      flex: "none",
                    }}
                  >
                    {initialsOf(m.name)}
                  </span>

                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>
                        {m.name}
                      </span>
                      <Badge tone={m.role === "OWNER" ? "accent" : "neutral"}>{roleLabel[m.role]}</Badge>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 4,
                        fontSize: 13,
                        color: "var(--text-muted)",
                      }}
                    >
                      <Send size={13} color="var(--brand-500)" />
                      {linked ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          {t.telegramConnected} <Check size={13} color="var(--green-500)" />
                        </span>
                      ) : (
                        t.telegramNotLinked
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flex: "0 0 auto",
                    marginLeft: "auto",
                  }}
                >
                  {linked ? (
                    <Button variant="ghost" size="sm" icon={<X size={15} />} onClick={() => openUnlink(m)}>
                      {t.unlink}
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" icon={<Link2 size={15} />} onClick={() => openConnect(m)}>
                      {t.connectTelegram}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={15} />}
                    style={{ color: "var(--red-500)" }}
                    aria-label={t.removeAria(m.name)}
                    onClick={() => openDelete(m)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add person dialog */}
      <Dialog
        open={addOpen}
        title={t.addDialogTitle}
        description={t.addDialogDesc}
        confirmLabel={t.addPerson}
        cancelLabel={c.cancel}
        confirmDisabled={!addName.trim()}
        busy={addBusy}
        onConfirm={confirmAdd}
        onCancel={() => setAddOpen(false)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {addError !== null ? (
            <div role="alert" style={ERROR_BOX}>
              {errText(addError, t.addFailed)}
            </div>
          ) : null}
          <Field label={t.nameLabel} htmlFor="team-add-name" required>
            <Input
              id="team-add-name"
              placeholder={t.namePlaceholder}
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />
          </Field>
          <Field label={t.roleLabel} htmlFor="team-add-role">
            <Select
              id="team-add-role"
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as Role)}
            >
              <option value="STAFF">{t.roleStaff}</option>
              <option value="MANAGER">{t.roleManager}</option>
              <option value="OWNER">{t.roleOwner}</option>
            </Select>
          </Field>
        </div>
      </Dialog>

      {/* Connect Telegram dialog */}
      <Dialog
        open={connectTarget !== null}
        title={connectTarget ? t.connectTitle(connectTarget.name) : t.connectTitleFallback}
        confirmLabel={t.done}
        cancelLabel={c.close}
        width={440}
        onConfirm={closeConnect}
        onCancel={closeConnect}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 14, color: "var(--text-body)", margin: 0, lineHeight: 1.6 }}>
            {t.connectInstructionA(connectTarget ? firstNameOf(connectTarget.name) : t.them)}{" "}
            <strong>{t.connectInstructionStart}</strong> {t.connectInstructionB}
          </p>

          {connectLoading ? (
            <div aria-live="polite" style={{ fontSize: 13.5, color: "var(--text-muted)", padding: "8px 0" }}>
              {t.creatingLink}
            </div>
          ) : connectError !== null ? (
            <div role="alert" style={ERROR_BOX}>
              {errText(connectError, t.createLinkFailed)}
            </div>
          ) : connectLink?.deepLink ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                background: "var(--surface-sunken)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
              }}
            >
              <code
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12.5,
                  color: "var(--text-body)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {connectLink.deepLink}
              </code>
              <Button
                variant="ghost"
                size="sm"
                icon={copied ? <Check size={14} color="var(--green-500)" /> : <Copy size={14} />}
                onClick={copyLink}
              >
                {copied ? c.copied : c.copy}
              </Button>
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
              {t.noBotConfigured}
            </div>
          )}
        </div>
      </Dialog>

      {/* Unlink confirm dialog */}
      <Dialog
        open={unlinkTarget !== null}
        tone="danger"
        title={unlinkTarget ? t.unlinkTitle(unlinkTarget.name) : t.unlinkTitleFallback}
        description={unlinkTarget ? t.unlinkDesc(unlinkTarget.name) : undefined}
        confirmLabel={t.unlinkAction}
        cancelLabel={c.cancel}
        busy={unlinkBusy}
        onConfirm={confirmUnlink}
        onCancel={() => {
          if (!unlinkBusy) setUnlinkTarget(null);
        }}
      >
        {unlinkError !== null ? (
          <div role="alert" style={ERROR_BOX}>
            {errText(unlinkError, t.unlinkFailed)}
          </div>
        ) : null}
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={deleteTarget !== null}
        tone="danger"
        title={deleteTarget ? t.deleteTitle(deleteTarget.name) : t.deleteTitleFallback}
        description={t.deleteDesc}
        confirmLabel={c.remove}
        cancelLabel={c.cancel}
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
      >
        {deleteError !== null ? (
          <div role="alert" style={ERROR_BOX}>
            {errText(deleteError, t.removeFailed)}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
