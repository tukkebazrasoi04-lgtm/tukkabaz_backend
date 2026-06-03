import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Sends a WhatsApp notification to the admin phone number using the
 * Meta WhatsApp Cloud API (https://developers.facebook.com/docs/whatsapp/cloud-api).
 *
 * Required env vars:
 *  - ADMIN_WHATSAPP_PHONE  → Admin's WhatsApp number in international format (e.g. 919876543210)
 *  - WHATSAPP_PHONE_ID     → WhatsApp Business Phone Number ID from Meta dashboard
 *  - WHATSAPP_ACCESS_TOKEN → Permanent/system-user access token from Meta dashboard
 *
 * If any of the above are missing, the notification is silently skipped so the
 * rest of the app continues to work without WhatsApp configured.
 */

interface AdminNotifyPayload {
  /** Short category tag shown in bold at the top */
  title: string;
  /** Multi-line body text describing the event */
  body: string;
}

const WHATSAPP_API_VERSION = "v21.0";

/**
 * Fire-and-forget WhatsApp notification to the admin.
 * Never throws — failures are only logged so they don't break business flows.
 */
export async function notifyAdmin({ title, body }: AdminNotifyPayload): Promise<void> {
  const adminPhone = (env as Record<string, unknown>).ADMIN_WHATSAPP_PHONE as string | undefined;
  const phoneId = (env as Record<string, unknown>).WHATSAPP_PHONE_ID as string | undefined;
  const token = (env as Record<string, unknown>).WHATSAPP_ACCESS_TOKEN as string | undefined;

  if (!adminPhone || !phoneId || !token) {
    // WhatsApp not configured — skip silently
    logger.debug(`[notifyAdmin] skipped (WhatsApp not configured): ${title}`);
    return;
  }

  const message = `*${title}*\n\n${body}\n\n_Sent by Tukkabaz System_`;

  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: adminPhone,
        type: "text",
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      logger.warn(`[notifyAdmin] WhatsApp API returned ${response.status}: ${errorBody}`);
    } else {
      logger.info(`[notifyAdmin] WhatsApp sent: ${title}`);
    }
  } catch (error) {
    logger.warn(`[notifyAdmin] WhatsApp send failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ─── Convenience helpers for common events ──────────────────────────────────

export function notifyAdminNewBooking(details: {
  userName: string;
  itemTitle: string;
  kind: string;
  amount: number;
  reference?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
}): void {
  const lines = [
    `👤 Guest: ${details.userName}`,
    `🏷 ${details.kind === "ROOM" ? "Room" : "Experience"}: ${details.itemTitle}`,
    `💰 Amount: ₹${details.amount}`,
  ];
  if (details.reference) lines.push(`🧾 Ref: ${details.reference}`);
  if (details.checkIn) lines.push(`📅 Check-in: ${details.checkIn}`);
  if (details.checkOut) lines.push(`📅 Check-out: ${details.checkOut}`);

  void notifyAdmin({
    title: "🏨 New Reservation Confirmed",
    body: lines.join("\n"),
  });
}

export function notifyAdminNewDeliveryOrder(details: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  itemSummary: string;
  address: string;
}): void {
  void notifyAdmin({
    title: "🛵 New Delivery Order",
    body: [
      `📦 Order: ${details.orderNumber}`,
      `👤 Customer: ${details.customerName}`,
      `📞 Phone: ${details.customerPhone}`,
      `🍽 Items: ${details.itemSummary}`,
      `💰 Total: ₹${details.totalAmount}`,
      `📍 Address: ${details.address}`,
    ].join("\n"),
  });
}

export function notifyAdminPartnerApplication(details: {
  partnerName: string;
  phone: string;
  vehicleType: string;
}): void {
  void notifyAdmin({
    title: "🪪 New Partner DL Submitted",
    body: [
      `👤 Partner: ${details.partnerName}`,
      `📞 Phone: ${details.phone}`,
      `🏍 Vehicle: ${details.vehicleType}`,
      ``,
      `Please review and verify in the admin dashboard under Partners → Pending.`,
    ].join("\n"),
  });
}
