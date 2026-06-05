import { prisma } from "../lib/prisma";
import { sendPushNotifications } from "./expo-push";
import { logger } from "./logger";

let kitchenAlertInterval: NodeJS.Timeout | null = null;

export const startKitchenAlertLoop = () => {
  // Prevent multiple intervals (VERY IMPORTANT)
  if (kitchenAlertInterval) return;

  kitchenAlertInterval = setInterval(async () => {
    try {
      const pendingOrders = await prisma.deliveryOrder.findMany({
        where: { status: "PENDING" },
        select: { id: true, orderNumber: true }
      });

      if (pendingOrders.length === 0) return;

      const devices = await prisma.kitchenDevice.findMany({
        select: { pushToken: true }
      });

      if (devices.length === 0) return;

      const tokens = devices
        .map(d => d.pushToken)
        .filter(Boolean);

      const orderList = pendingOrders
        .map(o => `#${o.orderNumber}`)
        .join(", ");

      await sendPushNotifications(
        tokens,
        "URGENT: New Orders!",
        `Pending orders: ${orderList}`,
        {
          orderCount: pendingOrders.length
        },
        "high-priority-orders"
      ).catch((e) =>
        logger.error("Failed to send kitchen alert", e)
      );

    } catch (error: unknown) {
  logger.error("Error in kitchen alert loop", {
    error: error instanceof Error ? error.message : String(error)
  });
}
  }, 30000);
};