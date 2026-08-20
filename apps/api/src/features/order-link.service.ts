import { Injectable, Logger } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Signed one-tap order links.
 *
 * The point of these is that confirming an order must not require an app, an
 * account, or a chat bot. A reminder can be delivered by ANY channel — SMS,
 * Viber pasted by hand, a Telegram message — as a link that opens one page with
 * one button. That keeps the product's core loop independent of whichever
 * messaging platform we can afford this month, and it is also the only shape
 * Viber Business Messages supports, since that product has no custom keyboards.
 *
 * Authorization is the token itself: holding a valid signature for an order is
 * proof you received the reminder we sent to that order's assignee. There is no
 * session, so the action is attributed to the assigned user. The token is scoped
 * to ONE order and expires, so a leaked link cannot be replayed against another
 * order or used indefinitely.
 *
 * Token format: `<orderRunId>.<expiryEpochSeconds>.<signature>`
 * `orderRunId` is a UUID and `expiry` is digits, so neither can contain the "."
 * separator and the split is unambiguous.
 */

const TOKEN_TTL_DAYS = 14;
const SIG_LENGTH = 43; // base64url of a full SHA-256 digest, unpadded

export type OrderLinkFailure =
  | { ok: false; reason: "malformed" }
  | { ok: false; reason: "bad_signature" }
  | { ok: false; reason: "expired" }
  | { ok: false; reason: "not_found" };

export interface OrderLinkView {
  ok: true;
  orderRunId: string;
  restaurant: string;
  supplier: string;
  supplierContact: string | null;
  assignee: string;
  dueDate: string;
  cutoffTime: string | null;
  status: string;
  language: string;
  /** True while the order can still be confirmed (PENDING or ESCALATED). */
  actionable: boolean;
  submittedAt: string | null;
  lines: Array<{ item: string; quantity: string | null; unit: string | null; note: string | null }>;
}

export type OrderLinkSubmitResult =
  | { ok: true; outcome: "submitted" | "already_submitted"; language: string }
  | { ok: true; outcome: "closed"; status: string; language: string }
  | OrderLinkFailure;

@Injectable()
export class OrderLinkService {
  private readonly logger = new Logger(OrderLinkService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The signing key. Deliberately has no default: a predictable key would let
   * anyone mint a link for any order id, so a missing secret must break loudly
   * at the call site rather than silently downgrade to guessable tokens.
   */
  private secret(): Buffer {
    const raw = process.env.ORDER_LINK_SECRET;
    if (!raw || raw.length < 16) {
      throw new Error(
        "ORDER_LINK_SECRET is not set (min 16 chars). One-tap order links cannot be signed without it.",
      );
    }
    return Buffer.from(raw, "utf8");
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.secret()).update(payload).digest("base64url");
  }

  /** Mint a link token for one order, valid for TOKEN_TTL_DAYS. */
  createToken(orderRunId: string, ttlDays: number = TOKEN_TTL_DAYS): string {
    const exp = Math.floor(Date.now() / 1000) + ttlDays * 86_400;
    const payload = `${orderRunId}.${exp}`;
    return `${payload}.${this.sign(payload)}`;
  }

  /** Full URL a reminder should carry. */
  createUrl(orderRunId: string, webBaseUrl: string, ttlDays?: number): string {
    return `${webBaseUrl.replace(/\/$/, "")}/o/${this.createToken(orderRunId, ttlDays)}`;
  }

  /**
   * Verify a token. Compares in constant time so the signature cannot be
   * recovered by timing, and checks length first because timingSafeEqual throws
   * on a length mismatch.
   */
  private verify(token: string): { ok: true; orderRunId: string } | OrderLinkFailure {
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, reason: "malformed" };
    const [orderRunId, expRaw, sig] = parts;
    if (!orderRunId || !/^\d+$/.test(expRaw ?? "") || !sig) return { ok: false, reason: "malformed" };

    const expected = this.sign(`${orderRunId}.${expRaw}`);
    if (sig.length !== expected.length || sig.length !== SIG_LENGTH) {
      return { ok: false, reason: "bad_signature" };
    }
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { ok: false, reason: "bad_signature" };
    }
    if (Number(expRaw) * 1000 < Date.now()) return { ok: false, reason: "expired" };
    return { ok: true, orderRunId };
  }

  /** Everything the public confirm page renders. */
  async view(token: string): Promise<OrderLinkView | OrderLinkFailure> {
    const checked = this.verify(token);
    if (!checked.ok) return checked;

    const run = await this.prisma.orderRun.findUnique({
      where: { id: checked.orderRunId },
      include: {
        tenant: { select: { name: true, language: true } },
        supplier: { select: { name: true, contact: true } },
        assignedUser: { select: { name: true } },
        orderRule: { select: { cutoffTime: true } },
        lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      },
    });
    if (!run) return { ok: false, reason: "not_found" };

    return {
      ok: true,
      orderRunId: run.id,
      restaurant: run.tenant.name,
      supplier: run.supplier.name,
      supplierContact: run.supplier.contact,
      assignee: run.assignedUser.name,
      dueDate: run.dueDate.toISOString().slice(0, 10),
      cutoffTime: run.orderRule.cutoffTime ?? null,
      status: run.status,
      language: run.tenant.language,
      actionable: run.status === "PENDING" || run.status === "ESCALATED",
      submittedAt: run.submittedAt ? run.submittedAt.toISOString() : null,
      lines: run.lines.map((line) => ({
        item: line.itemNameSnapshot,
        quantity: line.quantitySnapshot === null ? null : String(line.quantitySnapshot),
        unit: line.unitSnapshot,
        note: line.notesSnapshot,
      })),
    };
  }

  /**
   * Confirm the order. Attributed to the assigned user, because the link was
   * sent to them and the token proves possession of that reminder.
   *
   * The write is a conditional updateMany rather than a read-then-write: the
   * same order may be confirmed from the chat bot at the same moment, and
   * whichever lands second must report "already" instead of overwriting the
   * first submitter and resurrecting the nudge cycle.
   */
  async submit(token: string): Promise<OrderLinkSubmitResult> {
    const checked = this.verify(token);
    if (!checked.ok) return checked;

    const run = await this.prisma.orderRun.findUnique({
      where: { id: checked.orderRunId },
      select: {
        id: true,
        status: true,
        assignedUserId: true,
        tenant: { select: { language: true } },
      },
    });
    if (!run) return { ok: false, reason: "not_found" };
    const language = run.tenant.language;

    if (run.status !== "PENDING" && run.status !== "ESCALATED") {
      return run.status === "SUBMITTED"
        ? { ok: true, outcome: "already_submitted", language }
        : { ok: true, outcome: "closed", status: run.status, language };
    }

    const updated = await this.prisma.orderRun.updateMany({
      where: { id: run.id, status: { in: ["PENDING", "ESCALATED"] } },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedByUserId: run.assignedUserId,
        nextNudgeAt: null,
      },
    });

    if (updated.count === 1) {
      this.logger.log(`Order ${run.id} confirmed via one-tap link`);
      return { ok: true, outcome: "submitted", language };
    }
    return { ok: true, outcome: "already_submitted", language };
  }
}
