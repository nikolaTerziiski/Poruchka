# Poruchka — Bulgarian terminology canon

One word per concept, in the **web app and the Telegram bot alike**. When adding copy, take the term
from this table; do not invent a synonym. Established 2026-08-19 from
[AUDIT-2026-08-19.md](AUDIT-2026-08-19.md) §1.1.

## Core nouns

| Concept (code) | EN UI | **BG canon** | Retired — do not use |
|---|---|---|---|
| `OrderRule` | Order plan | **план** (full: *план за поръчка*) | ~~график~~, ~~разписание~~ |
| `OrderRun` | Order | **поръчка** | — |
| `Item` | Item | **артикул** | ~~стока~~, ~~продукт~~ |
| `Supplier` | Supplier | **доставчик** | — |
| `User` / team | Person | **човек от екипа** | — |
| Reminder | Reminder | **напомняне** | ~~известие~~ |
| Quiet hours | Quiet hours | **тихи часове** | ~~работно време~~ |
| Unit | Unit | **мярка** | — |

**Why *артикул* and not *продукт*:** in a restaurant "продукт" is ambiguous — it can mean the dish
being sold as easily as the supply being bought. *Артикул* is unambiguous and is the word already
printed on the Metro invoices these owners read every week.

**Why *план* and not *график*:** a график is a timetable; a план is the standing arrangement of
*what* to order from *whom*, of which the timing is only one part. The sidebar, the page title, the
bot and the empty-state CTA must all say план.

## Escalation — replace the jargon

"Ескалация / ескалирай / ескалирани" is corporate-support vocabulary a kitchen manager will not
parse. Use plain outcomes:

| Where | Instead of | Use |
|---|---|---|
| Order status | Ескалирана | **Просрочена** |
| Dashboard metric | Ескалирани — изискват внимание | **Просрочени — искат внимание** |
| Plan form field | Ескалирай към | **Резервен човек** (EN: *Backup person*) |
| Settings | преди ескалация | **преди да уведомим резервния човек** |

**The two roles are distinct — do not conflate them.** The *отговорник* is the person who places
the order and receives the reminders. The *резервен човек* is who gets told when the отговорник does
not react. Copy that says reminders repeat "преди да уведомим **отговорника**" is factually wrong:
the отговорник is precisely the one already being nudged.

## Style rules

1. **Address the reader with Вие in all prose.** Buttons use the terse imperative — see
   "Register" below for the split and why it is deliberate.
2. **Never assume gender.** Do not write "него", "неговия", "той". Rewrite around the pronoun:
   *"след като свържете профила в Telegram"*, not *"след като свържете неговия Telegram"*.
3. **Bulgarian quotation marks are „ … “** — never `" … "` and never `“ … ”`.
4. **Cyrillic for names used inside Bulgarian sentences:** **Метро**, not Metro. Product names that
   are Latin trademarks in their own right stay Latin: *Telegram*, *Viber*, *Poruchka*.
5. **Verbal nouns for in-flight states:** Запазване…, Изтриване…, Създаване… — not "Моля изчакайте".
6. **No bare prepositions as labels.** "За" is not a date label; write "Дата" or "За дата".
7. **Weekday abbreviations:** Пн, Вт, Ср, **Чт**, Пт, Сб, Нд — two letters, consistently.
   ("Чет" is not standard.)
8. **Plurals must agree with the number.** 1 минута / 2 минути; 1 ден / 2 дни. Never a fixed plural
   beside a free-number input.
9. **Money:** format with `Intl.NumberFormat("bg-BG")` and label the currency (лв.). Never a bare
   number with an English decimal point.
10. **"пилот" needs a qualifier** — *пилотния период*, not bare "пилота" (which reads as *aviator*).

## Error copy

Users never see HTTP status codes, JSON, or English. Map to these:

| Case | BG |
|---|---|
| Network / offline | Няма връзка със сървъра. Проверете интернета и опитайте пак. |
| 5xx | Нещо се обърка от наша страна. Опитайте отново след минута. |
| 401 / 403 | Достъпът ви изтече. Влезте отново, за да продължите. |
| 4xx | the page's own specific message |

Avoid „сесия" — it is jargon for kitchen staff.

## Register: Вие for prose, terse imperative for buttons

The app deliberately uses two forms, split by role. This is standard Bulgarian UI practice — a
button is a short command label, not an impolite address:

| Context | Form | Examples |
|---|---|---|
| Prose, hints, empty states, errors | **Вие** (polite plural) | „Изберете доставчик…", „Въведете поне едно количество.", „Създайте план за поръчка към Метро…" |
| Button and menu labels | **terse imperative** | „Добави артикул", „Изтрий артикул", „Копирай текста", „Създай план" |

The rule is *consistency within each role*. The bug this replaced was the same button reading
„Създайте план" on the Dashboard and „Създай план" on Orders. Never mix the two forms for the
same control.
