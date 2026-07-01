import { confirmedMessage, orderReminderMessage } from "./bot-copy";

describe("bot order reminder copy", () => {
  it("shows quantities only as optional usual-amount hints", () => {
    const text = orderReminderMessage("en", {
      supplier: "METRO",
      cutoffTime: "11:00",
      lines: [
        { name: "Pork neck", quantity: 5, unit: "kg" },
        { name: "Tomatoes", quantity: null, unit: "kg" },
      ],
    });

    expect(text).toContain("Check the supplier order for METRO");
    expect(text).toContain("• Pork neck (usual: 5 kg)");
    expect(text).toContain("• Tomatoes");
    expect(text).not.toContain("Tomatoes (usual:");
    expect(text).not.toContain("Tomatoes — kg");
    expect(text).toContain("Tap “Done” once you've handled it.");
  });

  it("localizes usual-amount hints in Bulgarian", () => {
    const text = orderReminderMessage("bg", {
      supplier: "Плод и зеленчук",
      lines: [
        { name: "Домати", quantity: 8, unit: "кг" },
        { name: "Магданоз", unit: "връзка" },
      ],
    });

    expect(text).toContain("Проверете поръчката към Плод и зеленчук");
    expect(text).toContain("• Домати (обичайно: 8 кг)");
    expect(text).toContain("• Магданоз");
    expect(text).not.toContain("Магданоз (обичайно:");
  });

  it("confirms completion without promising exact submitted quantities", () => {
    expect(confirmedMessage("en")).toContain("Marked as done");
    expect(confirmedMessage("en")).not.toContain("Ordered");
    expect(confirmedMessage("bg")).toContain("Отбелязано като готово");
  });
});
