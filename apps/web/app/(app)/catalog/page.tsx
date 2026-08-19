"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Package, Pencil, Phone, Plus, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";
import { Card } from "@/components/ds/Card";
import { Badge } from "@/components/ds/Badge";
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
}

interface Item {
  id: string;
  name: string;
  unit: string | null;
  notes: string | null;
  supplierId: string;
}

interface OrderRuleRef {
  id: string;
  supplierId: string;
  active: boolean;
}

const M = {
  en: {
    title: "Catalog",
    subtitle: "Suppliers and the goods you order from them",
    addSupplier: "Add supplier",
    editSupplier: "Edit supplier",
    deleteSupplierConfirm: "Delete supplier",
    supplierDeleteTitle: (name: string) => `Delete ${name}?`,
    supplierDeleteDescription:
      "This supplier will be removed. You can only delete a supplier with no items — reassign or delete its items first.",
    supplierNameLabel: "Name",
    supplierNamePlaceholder: "e.g. Metro",
    contactLabel: "Contact",
    contactHint: "Phone, email, or stall — optional",
    contactPlaceholder: "+359 …",
    noContact: "No contact saved",
    itemCount: (n: number) => (n === 1 ? "1 item" : `${n} items`),
    usedInPlans: (n: number) =>
      n === 0 ? "Not used in any order plan yet" : n === 1 ? "Used in 1 order plan" : `Used in ${n} order plans`,
    addItem: "Add item",
    editItem: "Edit item",
    deleteItemConfirm: "Delete item",
    itemDeleteTitle: (name: string) => `Delete ${name}?`,
    itemDeleteDescription: "This item will be removed. Any order plans using it will need a new item.",
    itemNameLabel: "Name",
    itemNamePlaceholder: "e.g. Pork Meat",
    unitLabel: "Unit",
    unitPlaceholder: "kg, keg, tray…",
    noteLabel: "Order note",
    noteHint: "What exactly to order — shown in the reminder (e.g. ≈20 kg, lean)",
    notePlaceholder: "≈20 kg, lean for the grill",
    colItem: "Item",
    colUnit: "Unit",
    colNote: "Note",
    emptySuppliersTitle: "No suppliers yet",
    emptySuppliersDescription: "Add Metro or your local market — their items live right here with them.",
    emptyItemsTitle: "No items from this supplier yet",
    emptyItemsDescription: "Add the goods you order from them — Pork Meat, Tomatoes, Sirene.",
    saveChanges: "Save changes",
    loadFailed: "Failed to load the catalog.",
    saveFailed: "Could not save.",
    deleteFailed: "Could not delete.",
    editAria: (name: string) => `Edit ${name}`,
    deleteAria: (name: string) => `Delete ${name}`,
    supplierListAria: "Suppliers",
  },
  bg: {
    title: "Каталог",
    subtitle: "Доставчици и стоките, които поръчвате от тях",
    addSupplier: "Добави доставчик",
    editSupplier: "Редактирай доставчик",
    deleteSupplierConfirm: "Изтрий доставчик",
    supplierDeleteTitle: (name: string) => `Изтриване на „${name}“?`,
    supplierDeleteDescription:
      "Доставчикът ще бъде премахнат. Можете да изтриете само доставчик без артикули — първо преместете или изтрийте артикулите му.",
    supplierNameLabel: "Име",
    supplierNamePlaceholder: "напр. Метро",
    contactLabel: "Контакт",
    contactHint: "Телефон, имейл или сергия — по избор",
    contactPlaceholder: "+359 …",
    noContact: "Няма запазен контакт",
    itemCount: (n: number) => (n === 1 ? "1 артикул" : `${n} артикула`),
    usedInPlans: (n: number) =>
      n === 0 ? "Все още не се използва в план" : n === 1 ? "Използва се в 1 план" : `Използва се в ${n} плана`,
    addItem: "Добави артикул",
    editItem: "Редактирай артикул",
    deleteItemConfirm: "Изтрий артикул",
    itemDeleteTitle: (name: string) => `Изтриване на „${name}“?`,
    itemDeleteDescription: "Артикулът ще бъде премахнат. Плановете, които го използват, ще се нуждаят от нов артикул.",
    itemNameLabel: "Име",
    itemNamePlaceholder: "напр. Свинско месо",
    unitLabel: "Мярка",
    unitPlaceholder: "кг, бъчва, каса…",
    noteLabel: "Бележка за поръчка",
    noteHint: "Какво точно да се поръча — показва се в напомнянето (напр. ≈20 кг, постно)",
    notePlaceholder: "≈20 кг, постно за скара",
    colItem: "Артикул",
    colUnit: "Мярка",
    colNote: "Бележка",
    emptySuppliersTitle: "Все още няма доставчици",
    emptySuppliersDescription: "Добавете Метро или местния пазар — артикулите им живеят тук, при тях.",
    emptyItemsTitle: "Все още няма артикули от този доставчик",
    emptyItemsDescription: "Добавете стоките, които поръчвате от него — свинско месо, домати, сирене.",
    saveChanges: "Запази промените",
    loadFailed: "Зареждането на каталога не бе успешно.",
    saveFailed: "Записът не бе успешен.",
    deleteFailed: "Изтриването не бе успешно.",
    editAria: (name: string) => `Редактирай ${name}`,
    deleteAria: (name: string) => `Изтрий ${name}`,
    supplierListAria: "Доставчици",
  },
} as const;

type SupplierDialog = { kind: "create" } | { kind: "edit"; supplier: Supplier } | null;
type ItemDialog = { kind: "create" } | { kind: "edit"; item: Item } | null;

export default function CatalogPage() {
  const t = useTr(M);
  const c = useCommon();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [rules, setRules] = useState<OrderRuleRef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Supplier create/edit dialog
  const [supplierDialog, setSupplierDialog] = useState<SupplierDialog>(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  // Item create/edit dialog (supplier is fixed to the selected one)
  const [itemDialog, setItemDialog] = useState<ItemDialog>(null);
  const [itemName, setItemName] = useState("");
  const [itemUnit, setItemUnit] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [savingItem, setSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  // Delete confirms
  const [supplierTarget, setSupplierTarget] = useState<Supplier | null>(null);
  const [itemTarget, setItemTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async (keepSelection?: string | null) => {
    setError(null);
    try {
      const [supplierList, itemList, ruleList] = await Promise.all([
        api<Supplier[]>("/suppliers"),
        api<Item[]>("/items"),
        api<OrderRuleRef[]>("/order-rules"),
      ]);
      setSuppliers(supplierList);
      setItems(itemList);
      setRules(ruleList);
      setSelectedId((prev) => {
        const wanted = keepSelection !== undefined ? keepSelection : prev;
        if (wanted && supplierList.some((s) => s.id === wanted)) return wanted;
        return supplierList[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadFailed);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemsBySupplier = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const item of items) (map[item.supplierId] ??= []).push(item);
    return map;
  }, [items]);

  const planCountBySupplier = useMemo(() => {
    const map: Record<string, number> = {};
    for (const rule of rules) map[rule.supplierId] = (map[rule.supplierId] ?? 0) + 1;
    return map;
  }, [rules]);

  const selected = suppliers.find((s) => s.id === selectedId) ?? null;
  const selectedItems = selected ? (itemsBySupplier[selected.id] ?? []) : [];

  function openSupplierCreate() {
    setSupplierName("");
    setSupplierContact("");
    setSupplierError(null);
    setSupplierDialog({ kind: "create" });
  }

  function openSupplierEdit(supplier: Supplier) {
    setSupplierName(supplier.name);
    setSupplierContact(supplier.contact ?? "");
    setSupplierError(null);
    setSupplierDialog({ kind: "edit", supplier });
  }

  async function saveSupplier() {
    if (!supplierDialog) return;
    const name = supplierName.trim();
    if (!name) return;
    setSavingSupplier(true);
    setSupplierError(null);
    try {
      if (supplierDialog.kind === "edit") {
        await api<Supplier>(`/suppliers/${supplierDialog.supplier.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, contact: supplierContact.trim() }),
        });
        await load();
      } else {
        const created = await api<Supplier>("/suppliers", {
          method: "POST",
          body: JSON.stringify({ name, contact: supplierContact.trim() }),
        });
        await load(created.id);
      }
      setSupplierDialog(null);
    } catch (e) {
      setSupplierError(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setSavingSupplier(false);
    }
  }

  function openItemCreate() {
    setItemName("");
    setItemUnit("");
    setItemNotes("");
    setItemError(null);
    setItemDialog({ kind: "create" });
  }

  function openItemEdit(item: Item) {
    setItemName(item.name);
    setItemUnit(item.unit ?? "");
    setItemNotes(item.notes ?? "");
    setItemError(null);
    setItemDialog({ kind: "edit", item });
  }

  async function saveItem() {
    if (!itemDialog || !selected) return;
    const name = itemName.trim();
    if (!name) return;
    const unit = itemUnit.trim();
    const notes = itemNotes.trim();
    setSavingItem(true);
    setItemError(null);
    try {
      if (itemDialog.kind === "create") {
        await api<Item>("/items", {
          method: "POST",
          body: JSON.stringify({
            name,
            supplierId: selected.id,
            ...(unit ? { unit } : {}),
            ...(notes ? { notes } : {}),
          }),
        });
      } else {
        await api<Item>(`/items/${itemDialog.item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, supplierId: itemDialog.item.supplierId, unit, notes }),
        });
      }
      await load();
      setItemDialog(null);
    } catch (e) {
      setItemError(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setSavingItem(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      if (supplierTarget) {
        await api(`/suppliers/${supplierTarget.id}`, { method: "DELETE" });
        setSupplierTarget(null);
        await load(null);
      } else if (itemTarget) {
        await api(`/items/${itemTarget.id}`, { method: "DELETE" });
        setItemTarget(null);
        await load();
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : t.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <style>{`
        .catalog-grid { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (max-width: 900px) { .catalog-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>

      <PageHead
        title={t.title}
        subtitle={t.subtitle}
        action={
          <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={openSupplierCreate}>
            {t.addSupplier}
          </Button>
        }
      />

      {error ? (
        <div style={{ marginBottom: 16, fontSize: 14, color: "var(--red-600)" }}>{error}</div>
      ) : null}

      {loading ? (
        <div style={{ fontSize: 14, color: "var(--text-faint)" }}>{c.loading}</div>
      ) : suppliers.length === 0 ? (
        <Card pad="none">
          <EmptyState
            icon={<Store size={22} />}
            title={t.emptySuppliersTitle}
            description={t.emptySuppliersDescription}
            action={
              <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={openSupplierCreate}>
                {t.addSupplier}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="catalog-grid">
          <Card pad="none" style={{ overflow: "hidden" }} aria-label={t.supplierListAria}>
            {suppliers.map((s, i) => {
              const on = s.id === selectedId;
              const count = (itemsBySupplier[s.id] ?? []).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    padding: "12px 14px",
                    border: "none",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
                    borderLeft: on ? "3px solid var(--brand-500)" : "3px solid transparent",
                    background: on ? "var(--brand-50)" : "transparent",
                  }}
                  aria-pressed={on}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: on ? 600 : 500, color: on ? "var(--brand-700)" : "var(--text-strong)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                      {s.name}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {t.itemCount(count)}
                    </span>
                  </span>
                  <ChevronRight size={15} color={on ? "var(--brand-500)" : "var(--text-faint)"} style={{ flex: "none" }} />
                </button>
              );
            })}
          </Card>

          {selected ? (
            <Card pad="md">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-strong)", letterSpacing: "-0.01em" }}>
                    {selected.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, fontSize: 13, color: selected.contact ? "var(--text-muted)" : "var(--text-faint)" }}>
                    <Phone size={13} />
                    {selected.contact || t.noContact}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Badge tone={planCountBySupplier[selected.id] ? "accent" : "neutral"} size="sm">
                      {t.usedInPlans(planCountBySupplier[selected.id] ?? 0)}
                    </Badge>
                  </div>
                </div>
                <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil size={15} />}
                    aria-label={t.editAria(selected.name)}
                    onClick={() => openSupplierEdit(selected)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={15} color="var(--red-500)" />}
                    aria-label={t.deleteAria(selected.name)}
                    onClick={() => setSupplierTarget(selected)}
                  />
                  <Button variant="secondary" size="sm" icon={<Plus size={15} />} onClick={openItemCreate}>
                    {t.addItem}
                  </Button>
                </div>
              </div>

              {selectedItems.length === 0 ? (
                <EmptyState
                  icon={<Package size={20} />}
                  title={t.emptyItemsTitle}
                  description={t.emptyItemsDescription}
                  action={
                    <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={openItemCreate}>
                      {t.addItem}
                    </Button>
                  }
                />
              ) : (
                <div style={{ overflowX: "auto" }}>
                <Table<Item>
                  columns={[
                    { key: "name", label: t.colItem },
                    { key: "unit", label: t.colUnit, width: 110 },
                    { key: "notes", label: t.colNote },
                    { key: "actions", label: "", align: "right", width: 90 },
                  ]}
                  rows={selectedItems}
                  rowKey={(r) => r.id}
                  renderCell={(r, key) => {
                    if (key === "name") {
                      return <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{r.name}</span>;
                    }
                    if (key === "unit") {
                      return r.unit ? (
                        <Badge tone="neutral">{r.unit}</Badge>
                      ) : (
                        <span style={{ color: "var(--text-faint)" }}>—</span>
                      );
                    }
                    if (key === "notes") {
                      return r.notes ? (
                        <span style={{ color: "var(--text-muted)" }}>{r.notes}</span>
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
                          onClick={() => openItemEdit(r)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={15} color="var(--red-500)" />}
                          aria-label={t.deleteAria(r.name)}
                          onClick={() => setItemTarget(r)}
                        />
                      </div>
                    );
                  }}
                />
                </div>
              )}
            </Card>
          ) : null}
        </div>
      )}

      <Dialog
        open={supplierDialog !== null}
        title={supplierDialog?.kind === "edit" ? t.editSupplier : t.addSupplier}
        confirmLabel={supplierDialog?.kind === "edit" ? t.saveChanges : t.addSupplier}
        cancelLabel={c.cancel}
        confirmDisabled={!supplierName.trim()}
        busy={savingSupplier}
        onConfirm={saveSupplier}
        onCancel={() => {
          if (!savingSupplier) setSupplierDialog(null);
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label={t.supplierNameLabel} htmlFor="catalog-supplier-name" required>
            <Input
              id="catalog-supplier-name"
              value={supplierName}
              autoFocus
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder={t.supplierNamePlaceholder}
              required
            />
          </Field>
          <Field label={t.contactLabel} htmlFor="catalog-supplier-contact" hint={t.contactHint}>
            <Input
              id="catalog-supplier-contact"
              value={supplierContact}
              onChange={(e) => setSupplierContact(e.target.value)}
              placeholder={t.contactPlaceholder}
            />
          </Field>
          {supplierError ? (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--red-600)" }}>{supplierError}</span>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={itemDialog !== null}
        title={itemDialog?.kind === "edit" ? t.editItem : t.addItem}
        confirmLabel={itemDialog?.kind === "edit" ? t.saveChanges : t.addItem}
        cancelLabel={c.cancel}
        confirmDisabled={!itemName.trim()}
        busy={savingItem}
        onConfirm={saveItem}
        onCancel={() => {
          if (!savingItem) setItemDialog(null);
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {selected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-muted)" }}>
              <Store size={14} color="var(--text-faint)" /> {selected.name}
            </div>
          ) : null}
          <Field label={t.itemNameLabel} htmlFor="catalog-item-name" required>
            <Input
              id="catalog-item-name"
              placeholder={t.itemNamePlaceholder}
              value={itemName}
              autoFocus
              onChange={(e) => setItemName(e.target.value)}
            />
          </Field>
          <Field label={t.unitLabel} htmlFor="catalog-item-unit" hint={c.optional}>
            <Input
              id="catalog-item-unit"
              placeholder={t.unitPlaceholder}
              value={itemUnit}
              onChange={(e) => setItemUnit(e.target.value)}
            />
          </Field>
          <Field label={t.noteLabel} htmlFor="catalog-item-notes" hint={t.noteHint}>
            <Input
              id="catalog-item-notes"
              placeholder={t.notePlaceholder}
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
            />
          </Field>
          {itemError ? (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--red-600)" }}>{itemError}</span>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={supplierTarget !== null || itemTarget !== null}
        tone="danger"
        title={
          supplierTarget
            ? t.supplierDeleteTitle(supplierTarget.name)
            : itemTarget
              ? t.itemDeleteTitle(itemTarget.name)
              : ""
        }
        description={supplierTarget ? t.supplierDeleteDescription : t.itemDeleteDescription}
        confirmLabel={supplierTarget ? t.deleteSupplierConfirm : t.deleteItemConfirm}
        cancelLabel={c.cancel}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (deleting) return;
          setSupplierTarget(null);
          setItemTarget(null);
          setDeleteError(null);
        }}
      >
        {deleteError ? (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--red-600)" }}>{deleteError}</span>
        ) : null}
      </Dialog>
    </div>
  );
}
