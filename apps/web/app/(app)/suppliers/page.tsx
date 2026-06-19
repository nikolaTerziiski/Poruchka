"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Store } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";
import { Card } from "@/components/ds/Card";
import { Table } from "@/components/ds/Table";
import { EmptyState } from "@/components/ds/EmptyState";
import { Dialog } from "@/components/ds/Dialog";
import { PageHead } from "@/components/ds/PageHead";
import { api } from "@/lib/api";
import { useTr, useCommon } from "@/lib/i18n";

interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  createdAt: string;
}

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
      "This supplier will be removed. Items tied to it will be left without one until reassigned.",
    deleteConfirm: "Delete supplier",
    loadFailed: "Failed to load suppliers.",
    saveFailed: "Failed to save supplier.",
    deleteFailed: "Failed to delete supplier.",
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
    deleteFallbackTitle: "Изтриване на доставчик?",
    deleteDescription:
      "Доставчикът ще бъде премахнат. Артикулите, свързани с него, ще останат без доставчик, докато не им зададете нов.",
    deleteConfirm: "Изтрий доставчик",
    loadFailed: "Зареждането на доставчиците не бе успешно.",
    saveFailed: "Запазването на доставчика не бе успешно.",
    deleteFailed: "Изтриването на доставчика не бе успешно.",
    editAria: (name: string) => `Редактирай ${name}`,
    deleteAria: (name: string) => `Изтрий ${name}`,
  },
} as const;

export default function SuppliersPage() {
  const t = useTr(M);
  const c = useCommon();
  const COLUMNS = [
    { key: "name", label: t.colSupplier },
    { key: "contact", label: t.colContact },
    { key: "actions", label: "", align: "right" as const, width: 90 },
  ];
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/Edit dialog state. `editing` null while closed; a Supplier when
  // editing; a sentinel "new" marker (editing === undefined) for create.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm state.
  const [target, setTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Supplier[]>("/suppliers");
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadFailed);
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
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setName(supplier.name);
    setContact(supplier.contact ?? "");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
  }

  async function saveForm() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const trimmedContact = contact.trim();
    setSaving(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    setError(null);
    try {
      await api(`/suppliers/${target.id}`, { method: "DELETE" });
      setTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

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

      {error ? (
        <div style={{ marginBottom: 16, fontSize: 14, color: "var(--red-600)" }}>{error}</div>
      ) : null}

      {loading ? (
        <div style={{ fontSize: 14, color: "var(--text-faint)" }}>{c.loading}</div>
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
                <span style={{ color: "var(--text-faint)" }}>—</span>
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
                  onClick={() => setTarget(r)}
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
        confirmLabel={t.deleteConfirm}
        cancelLabel={c.cancel}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setTarget(null);
        }}
      />
    </div>
  );
}
