"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Package, Store } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";
import { Select } from "@/components/ds/Select";
import { Badge } from "@/components/ds/Badge";
import { Table } from "@/components/ds/Table";
import { EmptyState } from "@/components/ds/EmptyState";
import { Dialog } from "@/components/ds/Dialog";
import { PageHead } from "@/components/ds/PageHead";
import { api } from "@/lib/api";
import { useTr, useCommon } from "@/lib/i18n";

const M = {
  en: {
    title: "Items",
    subtitle: "The goods you order, each tied to a supplier",
    addItem: "Add item",
    addSupplierFirst: "Add a supplier first",
    colItem: "Item",
    colSupplier: "Supplier",
    colUnit: "Unit",
    emptyTitle: "No items yet",
    emptyDescription: "Add the goods you order — Pork Meat, Tomatoes, Sirene — each tied to a supplier.",
    editItem: "Edit item",
    saveChanges: "Save changes",
    nameLabel: "Name",
    namePlaceholder: "e.g. Pork Meat",
    supplierLabel: "Supplier",
    selectSupplier: "Select a supplier…",
    unitLabel: "Unit",
    unitPlaceholder: "kg, keg, tray…",
    noteLabel: "Order note",
    noteHint: "What exactly to order — shown in the reminder (e.g. ≈20 kg, lean)",
    notePlaceholder: "≈20 kg, lean for the grill",
    deleteTitle: (name: string) => `Delete ${name}?`,
    deleteDescription: "This item will be removed. Any schedules using it will need a new item.",
    deleteConfirm: "Delete item",
    loadFailed: "Failed to load items.",
    saveFailed: "Could not save item.",
    deleteFailed: "Could not delete item.",
    loadingItems: "Loading items…",
    editAria: "Edit item",
    deleteAria: "Delete item",
  },
  bg: {
    title: "Артикули",
    subtitle: "Стоките, които поръчвате, всяка свързана с доставчик",
    addItem: "Добави артикул",
    addSupplierFirst: "Първо добавете доставчик",
    colItem: "Артикул",
    colSupplier: "Доставчик",
    colUnit: "Мярка",
    emptyTitle: "Все още няма артикули",
    emptyDescription:
      "Добавете стоките, които поръчвате — свинско месо, домати, сирене — всяка свързана с доставчик.",
    editItem: "Редактирай артикул",
    saveChanges: "Запази промените",
    nameLabel: "Име",
    namePlaceholder: "напр. Свинско месо",
    supplierLabel: "Доставчик",
    selectSupplier: "Изберете доставчик…",
    unitLabel: "Мярка",
    unitPlaceholder: "кг, бъчва, каса…",
    noteLabel: "Бележка за поръчка",
    noteHint: "Какво точно да се поръча — показва се в напомнянето (напр. ≈20 кг, постно)",
    notePlaceholder: "≈20 кг, постно за скара",
    deleteTitle: (name: string) => `Изтриване на „${name}“?`,
    deleteDescription:
      "Артикулът ще бъде премахнат. Всички графици, които го използват, ще се нуждаят от нов артикул.",
    deleteConfirm: "Изтрий артикул",
    loadFailed: "Зареждането на артикулите не бе успешно.",
    saveFailed: "Артикулът не може да бъде запазен.",
    deleteFailed: "Артикулът не може да бъде изтрит.",
    loadingItems: "Зареждане на артикулите…",
    editAria: "Редактирай артикул",
    deleteAria: "Изтрий артикул",
  },
} as const;

interface Supplier {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  unit: string | null;
  notes: string | null;
  supplierId: string;
  supplier: { id: string; name: string };
}

type DialogMode =
  | { kind: "create" }
  | { kind: "edit"; item: Item }
  | null;

export default function ItemsPage() {
  const t = useTr(M);
  const c = useCommon();
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Create / edit dialog
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [name, setName] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete dialog
  const [target, setTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refetchItems = useCallback(async () => {
    const next = await api<Item[]>("/items");
    setItems(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [nextItems, nextSuppliers] = await Promise.all([
          api<Item[]>("/items"),
          api<Supplier[]>("/suppliers"),
        ]);
        if (cancelled) return;
        setItems(nextItems);
        setSuppliers(nextSuppliers);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t.loadFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function openCreate() {
    setName("");
    setSupplierId(suppliers[0]?.id ?? "");
    setUnit("");
    setNotes("");
    setFormError(null);
    setDialog({ kind: "create" });
  }

  function openEdit(item: Item) {
    setName(item.name);
    setSupplierId(item.supplierId);
    setUnit(item.unit ?? "");
    setNotes(item.notes ?? "");
    setFormError(null);
    setDialog({ kind: "edit", item });
  }

  function closeDialog() {
    if (saving) return;
    setDialog(null);
  }

  async function handleSave() {
    if (!dialog) return;
    const trimmedName = name.trim();
    const trimmedUnit = unit.trim();
    const trimmedNotes = notes.trim();
    if (!trimmedName || !supplierId) return;

    setSaving(true);
    setFormError(null);
    try {
      if (dialog.kind === "create") {
        await api<Item>("/items", {
          method: "POST",
          body: JSON.stringify({
            name: trimmedName,
            supplierId,
            ...(trimmedUnit ? { unit: trimmedUnit } : {}),
            ...(trimmedNotes ? { notes: trimmedNotes } : {}),
          }),
        });
      } else {
        await api<Item>(`/items/${dialog.item.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: trimmedName,
            supplierId,
            unit: trimmedUnit,
            notes: trimmedNotes,
          }),
        });
      }
      await refetchItems();
      setDialog(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!target) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api<void>(`/items/${target.id}`, { method: "DELETE" });
      await refetchItems();
      setTarget(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : t.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  const noSuppliers = suppliers.length === 0;
  const formInvalid = name.trim().length === 0 || supplierId.length === 0;

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title={t.title}
        subtitle={t.subtitle}
        action={
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <Button icon={<Plus size={16} />} onClick={openCreate} disabled={noSuppliers}>
              {t.addItem}
            </Button>
            {noSuppliers ? (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {t.addSupplierFirst}
              </span>
            ) : null}
          </div>
        }
      />

      {loading ? (
        <div style={{ padding: "48px 0", textAlign: "center", fontSize: "var(--text-sm)", color: "var(--text-faint)" }}>
          {t.loadingItems}
        </div>
      ) : error ? (
        <div style={{ padding: "48px 0", textAlign: "center", fontSize: "var(--text-sm)", color: "var(--red-600)" }}>
          {error}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={t.emptyTitle}
          description={t.emptyDescription}
          action={
            <Button icon={<Plus size={16} />} onClick={openCreate} disabled={noSuppliers}>
              {t.addItem}
            </Button>
          }
        />
      ) : (
        <Table<Item>
          columns={[
            { key: "name", label: t.colItem },
            { key: "supplier", label: t.colSupplier },
            { key: "unit", label: t.colUnit, width: 110 },
            { key: "actions", label: "", align: "right", width: 90 },
          ]}
          rows={items}
          rowKey={(r) => r.id}
          renderCell={(r, key) => {
            if (key === "name") {
              return <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{r.name}</span>;
            }
            if (key === "supplier") {
              return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Store size={14} color="var(--text-faint)" />
                  {r.supplier.name}
                </span>
              );
            }
            if (key === "unit") {
              return r.unit ? (
                <Badge tone="neutral">{r.unit}</Badge>
              ) : (
                <span style={{ color: "var(--text-faint)" }}>—</span>
              );
            }
            return (
              <div style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}>
                <Button variant="ghost" size="sm" icon={<Pencil size={15} />} aria-label={t.editAria} onClick={() => openEdit(r)} />
                <Button variant="ghost" size="sm" icon={<Trash2 size={15} color="var(--red-500)" />} aria-label={t.deleteAria} onClick={() => setTarget(r)} />
              </div>
            );
          }}
        />
      )}

      {dialog ? (
        <Dialog
          open
          title={dialog.kind === "create" ? t.addItem : t.editItem}
          confirmLabel={dialog.kind === "create" ? t.addItem : t.saveChanges}
          cancelLabel={c.cancel}
          confirmDisabled={formInvalid}
          busy={saving}
          onConfirm={handleSave}
          onCancel={closeDialog}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label={t.nameLabel} htmlFor="item-name" required>
              <Input
                id="item-name"
                placeholder={t.namePlaceholder}
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label={t.supplierLabel} htmlFor="item-supplier" required>
              <Select
                id="item-supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="" disabled>
                  {t.selectSupplier}
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.unitLabel} htmlFor="item-unit" hint={c.optional}>
              <Input
                id="item-unit"
                placeholder={t.unitPlaceholder}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </Field>
            <Field label={t.noteLabel} htmlFor="item-notes" hint={t.noteHint}>
              <Input
                id="item-notes"
                placeholder={t.notePlaceholder}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            {formError ? (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--red-600)" }}>{formError}</span>
            ) : null}
          </div>
        </Dialog>
      ) : null}

      {target ? (
        <Dialog
          open
          tone="danger"
          title={t.deleteTitle(target.name)}
          description={t.deleteDescription}
          confirmLabel={t.deleteConfirm}
          cancelLabel={c.cancel}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => {
            if (deleting) return;
            setTarget(null);
            setDeleteError(null);
          }}
        >
          {deleteError ? (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--red-600)" }}>{deleteError}</span>
          ) : null}
        </Dialog>
      ) : null}
    </div>
  );
}
