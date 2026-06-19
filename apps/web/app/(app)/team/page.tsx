"use client";

import { useEffect, useState } from "react";
import { UserPlus, Send, Check, Link2, X, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";
import { Select } from "@/components/ds/Select";
import { Badge } from "@/components/ds/Badge";
import { Dialog } from "@/components/ds/Dialog";
import { PageHead } from "@/components/ds/PageHead";
import { api } from "@/lib/api";
import { useTr, useCommon, useLang, type Lang } from "@/lib/i18n";

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

const ROLE_LABEL: Record<Lang, Record<Role, string>> = {
  en: { OWNER: "Owner", MANAGER: "Manager", STAFF: "Staff" },
  bg: { OWNER: "Собственик", MANAGER: "Мениджър", STAFF: "Персонал" },
};

const M = {
  en: {
    title: "Team",
    subtitle: "Who places orders, and how they're reached",
    addPerson: "Add person",
    loadFailed: "Failed to load team",
    loadingTeam: "Loading team…",
    emptyTitle: "No one on the team yet",
    emptyDesc: "Add the people who place orders so they can receive reminders.",
    telegramConnected: "Telegram connected",
    telegramNotLinked: "Telegram not linked yet",
    connectTelegram: "Connect Telegram",
    unlink: "Unlink",
    unlinkFailed: "Failed to unlink",
    removeAria: (name: string) => `Remove ${name}`,
    // Add person dialog
    addDialogTitle: "Add a person",
    addDialogDesc: "They'll receive reminders once you connect their Telegram.",
    addFailed: "Failed to add person",
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
    connectInstructionB: "— the bot links their chat automatically.",
    them: "them",
    creatingLink: "Creating link…",
    createLinkFailed: "Failed to create link",
    noBotConfigured: "The Telegram bot isn't configured yet, so there's no link to share.",
    // Delete confirm dialog
    deleteTitle: (name: string) => `Remove ${name}?`,
    deleteTitleFallback: "Remove person?",
    deleteDesc: "They'll stop receiving reminders. This can't be undone.",
    removeFailed: "Failed to remove person",
  },
  bg: {
    title: "Екип",
    subtitle: "Кой прави поръчки и как се свързвате с него",
    addPerson: "Добави човек",
    loadFailed: "Неуспешно зареждане на екипа",
    loadingTeam: "Зареждане на екипа…",
    emptyTitle: "Все още няма никого в екипа",
    emptyDesc: "Добавете хората, които правят поръчки, за да получават напомняния.",
    telegramConnected: "Telegram е свързан",
    telegramNotLinked: "Telegram все още не е свързан",
    connectTelegram: "Свържи Telegram",
    unlink: "Прекрати връзката",
    unlinkFailed: "Неуспешно прекратяване на връзката",
    removeAria: (name: string) => `Премахни ${name}`,
    // Add person dialog
    addDialogTitle: "Добавяне на човек",
    addDialogDesc: "Ще получава напомняния, след като свържете неговия Telegram.",
    addFailed: "Неуспешно добавяне на човек",
    nameLabel: "Име",
    namePlaceholder: "напр. Георги Илиев",
    roleLabel: "Роля",
    roleStaff: "Персонал",
    roleManager: "Мениджър",
    roleOwner: "Собственик",
    // Connect Telegram dialog
    connectTitle: (name: string) => `Свържи ${name} с Telegram`,
    connectTitleFallback: "Свържи с Telegram",
    done: "Готово",
    connectInstructionA: (firstName: string) => `Помолете ${firstName} да отвори тази връзка в Telegram и да натисне`,
    connectInstructionStart: "Старт",
    connectInstructionB: "— ботът автоматично свързва неговия чат.",
    them: "този човек",
    creatingLink: "Създаване на връзка…",
    createLinkFailed: "Неуспешно създаване на връзка",
    noBotConfigured: "Telegram ботът все още не е настроен, затова няма връзка за споделяне.",
    // Delete confirm dialog
    deleteTitle: (name: string) => `Да премахнем ли ${name}?`,
    deleteTitleFallback: "Да премахнем ли човека?",
    deleteDesc: "Ще спре да получава напомняния. Това не може да бъде отменено.",
    removeFailed: "Неуспешно премахване на човек",
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
  const roleLabel = ROLE_LABEL[lang];
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add person dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addRole, setAddRole] = useState<Role>("STAFF");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Connect Telegram dialog
  const [connectTarget, setConnectTarget] = useState<Member | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectLink, setConnectLink] = useState<LinkResponse | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Delete confirm dialog
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Member[]>("/team");
      setMembers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
      setAddError(e instanceof Error ? e.message : t.addFailed);
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
      setConnectError(e instanceof Error ? e.message : t.createLinkFailed);
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
  async function unlink(member: Member) {
    try {
      await api(`/team/${member.id}/unlink`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.unlinkFailed);
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
      setDeleteError(e instanceof Error ? e.message : t.removeFailed);
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

      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            background: "var(--surface-sunken)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            fontSize: 13.5,
            color: "var(--red-600)",
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {t.loadingTeam}
        </div>
      ) : members.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            background: "var(--surface-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-xs)",
            padding: "18px 20px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>{t.emptyTitle}</div>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 2 }}>
              {t.emptyDesc}
            </div>
          </div>
          <Button variant="primary" icon={<UserPlus size={16} />} onClick={openAdd}>
            {t.addPerson}
          </Button>
        </div>
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
                  gap: 16,
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-xl)",
                  boxShadow: "var(--shadow-xs)",
                  padding: "16px 20px",
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

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap" }}>
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

                {linked ? (
                  <Button variant="ghost" size="sm" icon={<X size={15} />} onClick={() => unlink(m)}>
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
          <Field label={t.nameLabel} htmlFor="team-add-name" required error={addError ?? undefined}>
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
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", padding: "8px 0" }}>{t.creatingLink}</div>
          ) : connectError ? (
            <div style={{ fontSize: 13.5, color: "var(--red-600)" }}>{connectError}</div>
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
        onCancel={() => setDeleteTarget(null)}
      >
        {deleteError ? (
          <div style={{ fontSize: 13.5, color: "var(--red-600)" }}>{deleteError}</div>
        ) : null}
      </Dialog>
    </div>
  );
}
