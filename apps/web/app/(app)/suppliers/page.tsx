"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Plus, Pencil, Trash2, Store } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";
import { Card } from "@/components/ds/Card";
import { Table } from "@/components/ds/Table";
import { EmptyState } from "@/components/ds/EmptyState";
import { Dialog } from "@/components/ds/Dialog";
import { PageHead } from "@/components/ds/PageHead";
import { api, ApiError } from "@/lib/api";
import { useTr, useCommon, useApiError } from "@/lib/i18n";

interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  createdAt: string;
}

/** One error surface for the whole app: tinted box, thin border, red text.
 *  Deliberately built on the raw red scale rather than --status-escalated-*,
 *  which is the *order status* palette — "this order is overdue" and "the app
 *  broke" must be able to look different later. Swap for a shared <Alert>
 *  (and --alert-error-* tokens) once components/ds/Alert.tsx exists. */
const ERROR_BOX: CSSProperties = {
  padding: "11px 14px",
  border: "1px solid var(--red-100)",
  borderRadius: "var(--radius-md)",
  background: "var(--red-50)",
  color: "var(--red-700)",
  fontSize: 13,
  lineHeight: 1.5,
};

const M = {
  en: {
    title: "Suppliers",
    subtitle: "Where you order from",
    addSupplier: "Add supplier",
    colSupplier: "Supplier",
    colContact: "Contact",
    emptyTitle: "No suppliers yet",
    emptyDescription: "Add Metro or your local market to start ordering from them.",
    editSupplier: "Edit supplier",
    saveChanges: "Save changes",
    nameLabel: "Name",
    namePlaceholder: "e.g. Metro",
    contactLabel: "Contact",
    contactHint: "Phone, email, or stall — optional",
    contactPlaceholder: "+359 …",
    deleteTitle: (name: string) => `Delete ${name}?`,
    deleteFallbackTitle: "Delete supplier?",
    deleteDescription:
      "The supplier will be permanently deleted. This is only possible if no items, order plans or past orders are linked to it.",
    deleteBlocked:
      "This supplier can't be deleted while items, order plans or orders are still linked to it. Move them to another supplier first.",
    loadFailed: "We couldn't load the suppliers. Please try again.",
    saveFailed: "We couldn't save the supplier. Please try again.",
    deleteFailed: "We couldn't delete the supplier. Please try again.",
    editAria: (name: string) => `Edit ${name}`,
    deleteAria: (name: string) => `Delete ${name}`,
  },
  bg: {
    title: "Доставчици",
    subtitle: "Откъде поръчвате",
    addSupplier: "Добави доставчик",
    colSupplier: "Доставчик",
    colContact: "Контакт",
    emptyTitle: "Все още няма доставчици",
    emptyDescription: "Добавете Метро или местния пазар, за да започнете да поръчвате от тях.",
    editSupplier: "Редактирай доставчик",
    saveChanges: "Запази промените",
    nameLabel: "Име",
    namePlaceholder: "напр. Метро",
    contactLabel: "Контакт",
    contactHint: "Телефон, имейл или сергия — по избор",
    contactPlaceholder: "+359 …",
    deleteTitle: (name: string) => `Изтриване на „${name}“?`,
    deleteFallbackTitle: "Изтриване на доставчика?",
    // The database forbids deleting a supplier that still has items, plans or
    // past orders (Restrict on all three relations), so the dialog must state
    // the condition instead of promising a cascade that never happens.
    deleteDescription:
      "Доставчикът ще бъде изтрит завинаги. Това е възможно само ако към него няма артикули, планове и минали поръчки.",
    deleteBlocked:
      "Този доставчик не може да бъде изтрит, защото към него все още има артикули, планове или поръчки. Първо ги прехвърлете към друг доставчик.",
    loadFailed: "Не успяхме да заредим доставчиците. Опитайте отново.",
    saveFailed: "Не успяхме да запазим доставчика. Опитайте отново.",
    deleteFailed: "Не успяхме да изтрием доставчика. Опитайте отново.",
    editAria: (name: string) => `Редактирай ${name}`,
    deleteAria: (name: string) => `Изтрий ${name}`,
  },
} as const;

export default function SuppliersPage() {
  const t = useTr(M);
  const c = useCommon();
  const errText = useApiError();
  const COLUMNS = [
    { key: "name", label: t.colSupplier },
    { key: "contact", label: t.colContact },
    { key: "actions", label: "", align: "right" as const, width: 90, stickyRight: true },
  ];
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  // The three error surfaces are stored as the raw thrown cause, never as a
  // translated string: the handlers then close over nothing language-dependent
  // (so their dependency arrays are honest) and switching EN/BG re-translates a
  // message that is already on screen.
  const [loadError, setLoadError] = useState<unknown>(null);

  // Create/Edit dialog state. `editing` null while closed; a Supplier when
  // editing; a sentinel "new" marker (editing === undefined) for create.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);

  // Delete confirm state.
  const [target, setTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api<Supplier[]>("/suppliers");
      setRows(data);
    } catch (e) {
      setLoadError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setContact("");
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setName(supplier.name);
    setContact(supplier.contact ?? "");
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setFormError(null);
  }

  function openDelete(supplier: Supplier) {
    setTarget(supplier);
    setDeleteError(null);
  }

  function closeDelete() {
    if (deleting) return;
    setTarget(null);
    setDeleteError(null);
  }

  async function saveForm() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const trimmedContact = contact.trim();
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await api<Supplier>(`/suppliers/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: trimmedName, contact: trimmedContact }),
        });
      } else {
        await api<Supplier>("/suppliers", {
          method: "POST",
          body: JSON.stringify({ name: trimmedName, contact: trimmedContact }),
        });
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError(e);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api(`/suppliers/${target.id}`, { method: "DELETE" });
      setTarget(null);
      await load();
    } catch (e) {
      // Stays open on failure — the reason is rendered inside the dialog, not
      // on the page behind the backdrop where nobody can read it.
      setDeleteError(e);
    } finally {
      setDeleting(false);
    }
  }

  // A 409 from DELETE /suppliers/:id means the supplier still has items, plans
  // or past orders attached; that is not a transient failure, so it gets its
  // own instruction instead of "try again".
  const deleteMessage =
    deleteError === null
      ? null
      : deleteError instanceof ApiError && deleteError.status === 409
        ? t.deleteBlocked
        : errText(deleteError, t.deleteFailed);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title={t.title}
        subtitle={t.subtitle}
        action={
          <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={openCreate}>
            {t.addSupplier}
          </Button>
        }
      />

      {loadError !== null ? (
        <div role="alert" style={{ ...ERROR_BOX, marginBottom: 18 }}>
          {errText(loadError, t.loadFailed)}
        </div>
      ) : null}

      {loading ? (
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{c.loading}</div>
      ) : rows.length === 0 ? (
        <Card pad="none">
          <EmptyState
            icon={<Store size={22} />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={
              <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={openCreate}>
                {t.addSupplier}
              </Button>
            }
          />
        </Card>
      ) : (
        <Table<Supplier>
          label={t.title}
          columns={COLUMNS}
          rows={rows}
          rowKey={(r) => r.id}
          renderCell={(r, key) => {
            if (key === "name") {
              return <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{r.name}</span>;
            }
            if (key === "contact") {
              return r.contact ? (
                <span style={{ color: "var(--text-muted)" }}>{r.contact}</span>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>—</span>
              );
            }
            return (
              <div style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil size={15} />}
                  aria-label={t.editAria(r.name)}
                  onClick={() => openEdit(r)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={15} color="var(--red-500)" />}
                  aria-label={t.deleteAria(r.name)}
                  onClick={() => openDelete(r)}
                />
              </div>
            );
          }}
        />
      )}

      <Dialog
        open={formOpen}
        title={editing ? t.editSupplier : t.addSupplier}
        confirmLabel={editing ? t.saveChanges : t.addSupplier}
        cancelLabel={c.cancel}
        confirmDisabled={!name.trim()}
        busy={saving}
        onConfirm={saveForm}
        onCancel={closeForm}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {formError !== null ? (
            <div role="alert" style={ERROR_BOX}>
              {errText(formError, t.saveFailed)}
            </div>
          ) : null}
          <Field label={t.nameLabel} htmlFor="supplier-name" required>
            <Input
              id="supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              required
            />
          </Field>
          <Field label={t.contactLabel} htmlFor="supplier-contact" hint={t.contactHint}>
            <Input
              id="supplier-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t.contactPlaceholder}
            />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={target !== null}
        tone="danger"
        title={target ? t.deleteTitle(target.name) : t.deleteFallbackTitle}
        description={t.deleteDescription}
        confirmLabel={c.delete}
        cancelLabel={c.cancel}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={closeDelete}
      >
        {deleteMessage ? (
          <div role="alert" style={ERROR_BOX}>
            {deleteMessage}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
