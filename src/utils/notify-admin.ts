import { env } from "../config/env";
import { logger } from "./logger";
import { prisma } from "../lib/prisma";
import { sendPushNotifications } from "./expo-push";

/**
 * Sends admin notifications via TWO channels (both fire-and-forget):
 *  1. Telegram Bot API (if TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID are set)
 *  2. Expo Push Notifications to all ADMIN users who have a pushToken
 *
 * Never throws — failures are only logged so they don't break business flows.
 */

interface AdminNotifyPayload {
  /** Short category tag shown in bold at the top */
  title: string;
  /** Multi-line body text describing the event */
  body: string;
}

async function sendTelegram(title: string, body: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    logger.debug(`[notifyAdmin] skipped Telegram (not configured): ${title}`);
    return;
  }

  const message = `*${title}*\n\n${body}\n\n_Sent by Tukkabaz System_`;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      logger.warn(`[notifyAdmin] Telegram API returned ${response.status}: ${errorBody}`);
    } else {
      logger.info(`[notifyAdmin] Telegram sent: ${title}`);
    }
  } catch (error) {
    logger.warn(`[notifyAdmin] Telegram send failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function sendAdminPush(title: string, body: string): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", pushToken: { not: null } },
      select: { pushToken: true }
    });

    const tokens = admins.map(a => a.pushToken as string).filter(t => t);
    if (tokens.length === 0) {
      logger.debug(`[notifyAdmin] no admin push tokens found`);
      return;
    }

    await sendPushNotifications(tokens, title, body, undefined, "admin-bookings");
    logger.info(`[notifyAdmin] Push sent to ${tokens.length} admin(s): ${title}`);
  } catch (error) {
    logger.warn(`[notifyAdmin] Push send failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function notifyAdmin({ title, body }: AdminNotifyPayload): Promise<void> {
  // Fire both channels in parallel — neither blocks the other
  await Promise.allSettled([
    sendTelegram(title, body),
    sendAdminPush(title, body)
  ]);
}
export async function notifyAvailableRiders(title: string, body: string): Promise<void> {
  try {
    // Look up all approved partners who are online and have a token registered
    const activePartners = await prisma.deliveryPartner.findMany({
      where: {
        isOnline: true,
        profileStatus: "APPROVED",
        pushToken: { not: null }
      },
      select: { pushToken: true }
    });

    const tokens = activePartners.map(p => p.pushToken as string).filter(Boolean);

    if (tokens.length === 0) {
      logger.debug(`[notifyRiders] No online delivery partner tokens found`);
      return;
    }

    // Pass the extracted tokens to your shared Expo Push utility
    await sendPushNotifications(tokens, title, body, undefined, 'urgent-orders-v3', 'order-alert.wav');
    logger.info(`[notifyRiders] Broadcasted push to ${tokens.length} rider(s)`);
  } catch (error) {
    logger.warn(`[notifyRiders] Broadcast failed: ${error instanceof Error ? error.message : String(error)}`);
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
  contactName?: string | null;
  contactPhone?: string | null;
  guests?: Array<{ name: string }>;
}): void {
  const lines = [
    `👤 Guest: ${details.userName}`,
    `🏷 ${details.kind === "ROOM" ? "Room" : "Experience"}: ${details.itemTitle}`,
    `💰 Amount: ₹${details.amount}`,
  ];
  if (details.contactName) lines.push(`🙍 Contact: ${details.contactName}`);
  if (details.contactPhone) lines.push(`📞 Phone: ${details.contactPhone}`);
  if (details.guests && details.guests.length > 0) {
    lines.push(`👥 Guests (${details.guests.length}): ${details.guests.map((g) => g.name).join(", ")}`);
  }
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
