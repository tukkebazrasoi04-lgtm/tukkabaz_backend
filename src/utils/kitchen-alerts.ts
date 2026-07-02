import { prisma } from "../lib/prisma";
import { sendPushNotifications } from "./expo-push";
import { logger } from "./logger";

let kitchenAlertInterval: NodeJS.Timeout | null = null;
const alertedOrders = new Set<string>();

export const startKitchenAlertLoop = () => {
  if (kitchenAlertInterval) return;

  kitchenAlertInterval = setInterval(async () => {
    try {
      const pendingOrders = await prisma.deliveryOrder.findMany({
        where: { status: "PENDING" },
        select: {
          id: true,
          orderNumber: true,
          items: true,
          // 1. Fetch the user's name from the database
          user: {
            select: { name: true }
          }
        }
      });

      if (pendingOrders.length === 0) {
        alertedOrders.clear();
        return;
      }

      const newPendingOrders = pendingOrders.filter(order => !alertedOrders.has(order.id));

      if (newPendingOrders.length === 0) return;

      const devices = await prisma.kitchenDevice.findMany({
        select: { pushToken: true }
      });

      if (devices.length === 0) return;

      const tokens = devices
        .map(d => d.pushToken)
        .filter(Boolean);

      // 2. Format the list to include the first 5 letters of the name
   // 2. Format the list to include the short name AND the food summary
      const orderList = newPendingOrders
        .map(o => {
          const customerName = o.user?.name || "Guest";
          const shortName = customerName.substring(0, 5);

          let foodSummary = "Items";
          const itemsArray = o.items as any[];

          if (itemsArray && itemsArray.length > 0) {
            // Because your array has { "name": "Masala Omelette" }, this grabs it perfectly!
            const firstFood = itemsArray[0].name;
            const extraCount = itemsArray.length - 1;

            if (extraCount > 0) {
              foodSummary = `${firstFood} (+${extraCount})`;
            } else {
              foodSummary = firstFood;
            }
          }

          return `#${o.orderNumber} (${shortName}): ${foodSummary}`;
        })
        .join("\n"); // Puts each order on a new line

      await sendPushNotifications(
        tokens,
        "URGENT: New Orders!",
        `Pending orders: ${orderList}`,
        {
          orderCount: newPendingOrders.length
        },
        'urgent-orders-v3',
        'order-alert.wav'
      ).catch((e) =>
        logger.error("Failed to send kitchen alert", e)
      );

      newPendingOrders.forEach(order => alertedOrders.add(order.id));

    } catch (error: unknown) {
      logger.error("Error in kitchen alert loop", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, 300000);
};