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

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
};

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
      setError(e instanceof Error ? e.message : "Failed to load team");
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
      setAddError(e instanceof Error ? e.message : "Failed to add person");
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
      setConnectError(e instanceof Error ? e.message : "Failed to create link");
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
      setError(e instanceof Error ? e.message : "Failed to unlink");
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
      setDeleteError(e instanceof Error ? e.message : "Failed to remove person");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title="Team"
        subtitle="Who places orders, and how they're reached"
        action={
          <Button variant="primary" icon={<UserPlus size={16} />} onClick={openAdd}>
            Add person
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
          Loading team…
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
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>No one on the team yet</div>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 2 }}>
              Add the people who place orders so they can receive reminders.
            </div>
          </div>
          <Button variant="primary" icon={<UserPlus size={16} />} onClick={openAdd}>
            Add person
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
                    <Badge tone={m.role === "OWNER" ? "accent" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
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
                        Telegram connected <Check size={13} color="var(--green-500)" />
                      </span>
                    ) : (
                      "Telegram not linked yet"
                    )}
                  </div>
                </div>

                {linked ? (
                  <Button variant="ghost" size="sm" icon={<X size={15} />} onClick={() => unlink(m)}>
                    Unlink
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" icon={<Link2 size={15} />} onClick={() => openConnect(m)}>
                    Connect Telegram
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={15} />}
                  style={{ color: "var(--red-500)" }}
                  aria-label={`Remove ${m.name}`}
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
        title="Add a person"
        description="They'll receive reminders once you connect their Telegram."
        confirmLabel="Add person"
        cancelLabel="Cancel"
        confirmDisabled={!addName.trim()}
        busy={addBusy}
        onConfirm={confirmAdd}
        onCancel={() => setAddOpen(false)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Name" htmlFor="team-add-name" required error={addError ?? undefined}>
            <Input
              id="team-add-name"
              placeholder="e.g. Georgi Iliev"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />
          </Field>
          <Field label="Role" htmlFor="team-add-role">
            <Select
              id="team-add-role"
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as Role)}
            >
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Manager</option>
              <option value="OWNER">Owner</option>
            </Select>
          </Field>
        </div>
      </Dialog>

      {/* Connect Telegram dialog */}
      <Dialog
        open={connectTarget !== null}
        title={connectTarget ? `Connect ${connectTarget.name} to Telegram` : "Connect to Telegram"}
        confirmLabel="Done"
        cancelLabel="Close"
        width={440}
        onConfirm={closeConnect}
        onCancel={closeConnect}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 14, color: "var(--text-body)", margin: 0, lineHeight: 1.6 }}>
            Ask {connectTarget ? firstNameOf(connectTarget.name) : "them"} to open this link in Telegram and tap{" "}
            <strong>Start</strong> — the bot links their chat automatically.
          </p>

          {connectLoading ? (
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", padding: "8px 0" }}>Creating link…</div>
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
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
              The Telegram bot isn&apos;t configured yet, so there&apos;s no link to share.
            </div>
          )}
        </div>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={deleteTarget !== null}
        tone="danger"
        title={deleteTarget ? `Remove ${deleteTarget.name}?` : "Remove person?"}
        description="They'll stop receiving reminders. This can't be undone."
        confirmLabel="Remove"
        cancelLabel="Cancel"
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
