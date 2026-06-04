import { prisma } from "../lib/prisma";
import { sendPushNotifications } from "./expo-push";
import { logger } from "./logger";

export const startKitchenAlertLoop = () => {
  // Run every 30 seconds
  setInterval(async () => {
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

      const tokens = devices.map(d => d.pushToken);
      
      for (const order of pendingOrders) {
        await sendPushNotifications(
          tokens,
          "URGENT: New Order!",
          `Order ${order.orderNumber} is waiting to be prepared!`,
          { orderId: order.id },
          'high-priority-orders'
        ).catch(e => logger.error("Failed to send kitchen alert", e));
      }
    } catch (error) {
      logger.error("Error in kitchen alert loop", error);
    }
  }, 30000);
};
