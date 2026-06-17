/**
 * Port for any outbound chat channel (Telegram now; Viber/WhatsApp later).
 * The domain talks to this interface only — adapters live under channels/<name>.
 */

export interface OutboundButton {
  /** Text shown on the button. */
  label: string;
  /** Opaque payload returned to us when the button is tapped (the reminder id). */
  payload: string;
}

export interface OutboundMessage {
  /** Channel-specific user id (Telegram chat id / Viber user id). */
  chatUserId: string;
  text: string;
  buttons?: OutboundButton[];
}

/** DI token for the active NotificationChannel implementation. */
export const NOTIFICATION_CHANNEL = Symbol("NOTIFICATION_CHANNEL");

export interface NotificationChannel {
  readonly channel: "telegram" | "viber" | "whatsapp";
  send(message: OutboundMessage): Promise<void>;
}
