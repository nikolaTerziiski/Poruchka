import {
  applyKeypadKey,
  parseQuantityEntry,
  quantityEntryMessage,
  quantityFromEntry,
  quantityLineButtonLabel,
  skipButtonLabel,
  skippedMessage,
  supplierOrderMessage,
} from "./bot-copy";

describe("bot copy for occurrence actions", () => {
  it("explains daily and weekly skips without implying that the plan changes", () => {
    expect(skipButtonLabel("en", "daily")).toBe("Skip today");
    expect(skipButtonLabel("en", "weekly")).toBe("Skip this week");
    // "schedule"/"scheduled occurrence" retired: docs/BG-TERMINOLOGY.md calls an
    // OrderRule a план / "order plan" and forbids the timetable words.
    expect(skippedMessage("en", "daily")).toContain("Tomorrow's order plan remains active");
    expect(skippedMessage("en", "weekly")).toContain("next order in the plan remains active");
  });

  it("builds a supplier-ready Bulgarian message with quantities and notes", () => {
    expect(
      supplierOrderMessage("bg", {
        restaurant: "Семеен ресторант",
        lines: [
          { item: "Свинско месо", quantity: "12", unit: "кг" },
          { item: "Домати", quantity: "4", unit: "касетки", note: "добре узрели" },
        ],
      }),
    ).toBe(
      "Здравейте,\n\nПоръчка от Семеен ресторант:\n" +
        "- Свинско месо: 12 кг\n" +
        "- Домати: 4 касетки — добре узрели\n\n" +
        "Моля, потвърдете поръчката.\nБлагодаря!",
    );
  });
});

describe("quantity keypad", () => {
  const type = (keys: string) => [...keys].reduce(applyKeypadKey, "");

  it("builds a number from taps", () => {
    expect(type("24")).toBe("24");
    expect(type("105")).toBe("105");
  });

  it("supports decimals without allowing a second point", () => {
    expect(type("2.5")).toBe("2.5");
    expect(applyKeypadKey("2.5", ".")).toBe("2.5");
    expect(applyKeypadKey("", ".")).toBe("0."); // leading point becomes 0.
  });

  it("backspaces and clears", () => {
    expect(applyKeypadKey("24", "b")).toBe("2");
    expect(applyKeypadKey("2", "b")).toBe("");
    expect(applyKeypadKey("", "b")).toBe("");
    expect(applyKeypadKey("24", "c")).toBe("");
  });

  it("does not accumulate leading zeros", () => {
    expect(type("007")).toBe("7");
    expect(type("0.5")).toBe("0.5");
  });

  it("respects the Decimal(12,3) and max-quantity bounds", () => {
    expect(applyKeypadKey("999999", "9")).toBe("999999"); // 7th whole digit rejected
    expect(applyKeypadKey("1.234", "5")).toBe("1.234"); // 4th decimal rejected
  });

  it("ignores keys that are not digits or editing commands", () => {
    expect(applyKeypadKey("24", "x")).toBe("24");
  });
});

describe("quantity entry round-trip", () => {
  it("reads back the in-progress entry it rendered (keeps the editor stateless)", () => {
    const rendered = quantityEntryMessage("bg", {
      item: "Свинско месо",
      unit: "кг",
      current: "24",
      entry: "30",
    });
    expect(rendered).toContain("Сега: 24");
    expect(parseQuantityEntry(rendered)).toBe("30");
  });

  it("treats an empty entry as empty, not as the placeholder", () => {
    const rendered = quantityEntryMessage("en", { item: "Pork", unit: "kg", current: null, entry: "" });
    expect(rendered).toContain("Currently: —");
    expect(parseQuantityEntry(rendered)).toBe("");
  });

  it("survives item names that contain digits or an equals sign", () => {
    const rendered = quantityEntryMessage("en", {
      item: "Cola 2L = case",
      unit: "case",
      current: "3",
      entry: "12.5",
    });
    expect(parseQuantityEntry(rendered)).toBe("12.5");
  });

  it("returns empty for unparseable text", () => {
    expect(parseQuantityEntry(undefined)).toBe("");
    expect(parseQuantityEntry("no entry line here")).toBe("");
  });
});

describe("quantityFromEntry", () => {
  it("accepts valid amounts", () => {
    expect(quantityFromEntry("24")).toBe(24);
    expect(quantityFromEntry("2.5")).toBe(2.5);
    expect(quantityFromEntry("0")).toBe(0);
  });

  it("rejects entries that cannot be stored", () => {
    expect(quantityFromEntry("")).toBeNull();
    expect(quantityFromEntry(".")).toBeNull();
    expect(quantityFromEntry("abc")).toBeNull();
  });
});

describe("quantityLineButtonLabel", () => {
  it("shows an em dash when a line has no quantity yet", () => {
    expect(quantityLineButtonLabel("Домати", null, "касетки")).toBe("Домати: —");
    expect(quantityLineButtonLabel("Домати", "4", "касетки")).toBe("Домати: 4 касетки");
  });
});
