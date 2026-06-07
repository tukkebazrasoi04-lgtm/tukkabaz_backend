import { DeliveryCategory, DeliveryOrderStatus, PaymentStatus, type DeliveryOrder, type Prisma, type Role } from "@prisma/client";
import crypto from "crypto";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import type { CreateDeliveryOrderInput, CreateDeliveryPartnerInput, DeliveryItemPayloadInput } from "../validators/delivery.validator";
import { normalizePhone } from "./otp.service";
import { notifyAdminPartnerApplication, notifyAdminNewDeliveryOrder, notifyAvailableRiders } from "../utils/notify-admin";
import { sendPushNotifications } from "../utils/expo-push";
import { createRazorpayOrder } from "../utils/razorpay";


const partnerAvailableStatuses = new Set<DeliveryOrderStatus>([
  DeliveryOrderStatus.DELIVERED,
  DeliveryOrderStatus.CANCELLED
]);

const activePartnerStatuses: DeliveryOrderStatus[] = [
  DeliveryOrderStatus.ACCEPTED,
  DeliveryOrderStatus.PREPARING,
  DeliveryOrderStatus.READY_FOR_PICKUP,
  DeliveryOrderStatus.PICKED_UP,
  DeliveryOrderStatus.OUT_FOR_DELIVERY
];

const MUKTESHWAR_PATTERN = /mukteshwar/i;

const deliveryOrderInclude = {
  partner: true,
  user: {
    select: {
      id: true,
      name: true,
      phone: true
    }
  }
} as const;

type OtpVisibility = "user" | "kitchen" | "admin" | "partner" | "none";

class DeliveryService {
  private serializeOrder<T extends DeliveryOrder & { partner?: unknown; user?: unknown }>(order: T, visibility: OtpVisibility) {
    return {
      ...order,
      // The kitchen sees the pickup OTP and reads it out to the rider at pickup.
      // (Admin board also fetches with "kitchen" visibility.)
      pickupOtp: visibility === "kitchen" ? order.pickupOtp : null,
      // Only the customer sees the delivery OTP; they read it out to the rider,
      // who types it back in to complete the order.
      deliveryOtp: visibility === "user" ? order.deliveryOtp : null,
      kitchenPhone: env.KITCHEN_PHONE_NUMBER ?? null
    };
  }

  private serializeOrders<T extends DeliveryOrder & { partner?: unknown; user?: unknown }>(orders: T[], visibility: OtpVisibility) {
    return orders.map((order) => this.serializeOrder(order, visibility));
  }

  async getItems(category?: DeliveryCategory) {
    return prisma.deliveryItem.findMany({
      where: {
        isAvailable: true,
        availableQuantity: { gt: 0 },
        ...(category ? { category } : {})
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async getContact() {
    return {
      kitchenPhone: env.KITCHEN_PHONE_NUMBER ?? null
    };
  }

  async createOrder(userId: string, input: CreateDeliveryOrderInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, "User not found.");
    }

    const customerPhone = normalizePhone(input.customerPhone);
    if (!customerPhone) {
      throw new AppError(400, "Please add your phone number before using delivery.");
    }
    if (env.KITCHEN_PHONE_NUMBER && normalizePhone(env.KITCHEN_PHONE_NUMBER) === customerPhone) {
      throw new AppError(409, "This phone number is reserved for kitchen operations.");
    }

    if (!MUKTESHWAR_PATTERN.test(input.deliveryAddress)) {
      throw new AppError(400, "Delivery is currently available only in Mukteshwar.");
    }

    if (user.phone !== customerPhone || !user.phoneVerifiedAt) {
      const existing = await prisma.user.findFirst({
        where: {
          phone: customerPhone,
          id: { not: userId }
        }
      });

      if (existing) {
        throw new AppError(409, "This phone number is already linked to another account.");
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          phone: customerPhone,
          phoneVerifiedAt: new Date(),
          deliveryAddress: input.deliveryAddress.trim()
        }
      });
    } else if (user.deliveryAddress !== input.deliveryAddress.trim()) {
      await prisma.user.update({
        where: { id: userId },
        data: { deliveryAddress: input.deliveryAddress.trim() }
      });
    }

    const itemIds = input.items.map((item) => item.itemId);
    const deliveryItems = await prisma.deliveryItem.findMany({
      where: {
        id: { in: itemIds },
        isAvailable: true,
        availableQuantity: { gt: 0 }
      }
    });

    if (deliveryItems.length !== new Set(itemIds).size) {
      throw new AppError(400, "One or more delivery items are unavailable.");
    }

    const itemById = new Map(deliveryItems.map((item) => [item.id, item]));
    const orderItems = input.items.map((inputItem) => {
      const item = itemById.get(inputItem.itemId);
      if (!item) {
        throw new AppError(400, "Delivery item not found.");
      }
      if (item.availableQuantity < inputItem.quantity) {
        throw new AppError(400, `${item.name} has only ${item.availableQuantity} left today.`);
      }

      return {
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: inputItem.quantity,
        imageUrl: item.imageUrl,
        category: item.category,
        lineTotal: item.price * inputItem.quantity
      };
    });

    const config = await this.getDeliveryConfig();
    const itemsSubtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

    let deliveryFee = 0;
    if (itemsSubtotal < config.freeDeliveryThreshold) {
      if (input.destinationLat !== undefined && input.destinationLng !== undefined) {
        const KITCHEN_LAT = 29.4727;
        const KITCHEN_LNG = 79.6479;
        const distance = this.calculateHaversineDistance(
          KITCHEN_LAT,
          KITCHEN_LNG,
          input.destinationLat,
          input.destinationLng
        );
        deliveryFee = Math.max(
          config.baseDeliveryFee,
          Math.round(config.baseDeliveryFee + distance * config.deliveryFeePerKm)
        );
      } else {
        deliveryFee = config.baseDeliveryFee;
      }
    }

    const totalAmount = itemsSubtotal + deliveryFee;
    const partnerCut = config.defaultRiderCut;

    const orderCount = await prisma.deliveryOrder.count();
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(6, "0")}`;

    let paymentReference = input.paymentReference?.trim() || null;
    let paymentStatus = input.paymentStatus ?? (input.paymentReference ? PaymentStatus.SUCCESS : PaymentStatus.PENDING);

    if (input.paymentProvider === "RAZORPAY" && !input.paymentReference) {
      const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = env;
      if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
        // Production/live: require a real Razorpay order so the payment signature
        // can be verified on confirmation. Do not fall back to an unverified
        // simulated reference on failure.
        const rzOrder = await createRazorpayOrder(totalAmount, orderNumber);
        paymentReference = rzOrder.id;
        paymentStatus = PaymentStatus.PENDING;
      } else {
        // No keys configured (local/dev only): simulated reference, no verification.
        paymentReference = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      for (const inputItem of input.items) {
        const updated = await tx.deliveryItem.updateMany({
          where: {
            id: inputItem.itemId,
            isAvailable: true,
            availableQuantity: { gte: inputItem.quantity }
          },
          data: {
            availableQuantity: { decrement: inputItem.quantity }
          }
        });

        if (updated.count !== 1) {
          throw new AppError(400, "One or more delivery items ran out before checkout.");
        }
      }

      const orderData = {
        orderNumber,
        userId,
        items: orderItems as Prisma.InputJsonValue,
        itemsSubtotal,
        deliveryFee,
        totalAmount,
        partnerCut,
        paymentProvider: input.paymentProvider?.trim() || "SIMULATED",
        paymentReference,
        paymentStatus,
        status: DeliveryOrderStatus.PENDING,
        deliveryAddress: input.deliveryAddress.trim(),
        customerPhone,
        destinationLat: input.destinationLat,
        destinationLng: input.destinationLng,
        // Pickup OTP the kitchen gives the rider to confirm pickup + start delivery.
        pickupOtp: String(Math.floor(1000 + Math.random() * 9000)),
        // Delivery OTP the customer shares with the rider to complete the order.
        deliveryOtp: String(Math.floor(1000 + Math.random() * 9000))
      } as unknown as Prisma.DeliveryOrderUncheckedCreateInput;

      return tx.deliveryOrder.create({
        data: orderData,
        include: deliveryOrderInclude
      });
    });

    if (order.paymentStatus === PaymentStatus.SUCCESS) {
      notifyAdminNewDeliveryOrder({
        orderNumber: order.orderNumber,
        customerName: user.name ?? 'Guest',
        customerPhone: user.phone ?? customerPhone,
        itemSummary: `${input.items.length} items`,
        totalAmount: totalAmount,
        address: input.deliveryAddress
      });
    }

    return { message: "Delivery order placed", order: this.serializeOrder(order, "user") };
  }

  async confirmDeliveryPayment(
    userId: string,
    input: {
      orderId: string;
      success: boolean;
      paymentReference?: string;
      razorpayPaymentId?: string;
      razorpayOrderId?: string;
      razorpaySignature?: string;
    }
  ) {
    const order = await prisma.deliveryOrder.findFirst({
      where: {
        id: input.orderId,
        userId
      }
    });

    if (!order) {
      throw new AppError(404, "Delivery order not found.");
    }

    if (order.paymentStatus === PaymentStatus.SUCCESS) {
      return {
        message: "Order payment already confirmed.",
        order: this.serializeOrder(order, "user")
      };
    }

    if (input.success && order.paymentReference?.startsWith("order_")) {
      const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = input;
      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        throw new AppError(400, "Missing Razorpay verification credentials.");
      }

      const { RAZORPAY_KEY_SECRET } = env;
      if (!RAZORPAY_KEY_SECRET) {
        throw new AppError(500, "Razorpay secret key is not configured on the server.");
      }

      if (order.paymentReference !== razorpayOrderId) {
        throw new AppError(400, "Order ID mismatch.");
      }

      const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(razorpayOrderId + "|" + razorpayPaymentId)
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        throw new AppError(400, "Payment verification failed - signature mismatch.");
      }
    }

    const updated = await prisma.deliveryOrder.update({
      where: { id: order.id },
      data: {
        paymentStatus: input.success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
        paymentReference: input.razorpayPaymentId ?? input.paymentReference ?? order.paymentReference
      },
      include: deliveryOrderInclude
    });

    if (input.success) {
      notifyAdminNewDeliveryOrder({
        orderNumber: updated.orderNumber,
        customerName: updated.user?.name ?? 'Guest',
        customerPhone: updated.customerPhone,
        itemSummary: `${(updated.items as any[]).length} items`,
        totalAmount: updated.totalAmount,
        address: updated.deliveryAddress
      });

      try {
        const devices = await prisma.kitchenDevice.findMany({ select: { pushToken: true } });
        const tokens = devices.map(d => d.pushToken);
        if (tokens.length > 0) {
          await sendPushNotifications(
            tokens,
            "URGENT: New Order!",
            `Order ${updated.orderNumber} is waiting to be prepared!`,
            { orderId: updated.id },
            'high-priority-orders'
          );
        }
      } catch (e) {
        console.error("Failed to send instant kitchen alert", e);
      }
    }

    return {
      message: input.success
        ? "Payment successful and delivery order accepted."
        : "Payment failed, order not accepted.",
      order: this.serializeOrder(updated, "user")
    };
  }

  async getMyOrders(userId: string) {
    const orders = await prisma.deliveryOrder.findMany({
      where: { userId },
      include: deliveryOrderInclude,
      orderBy: { createdAt: "desc" }
    });

    return { orders: this.serializeOrders(orders, "user") };
  }

  async getOrder(userId: string, orderId: string) {
    const order = await prisma.deliveryOrder.findFirst({
      where: { id: orderId, userId },
      include: deliveryOrderInclude
    });

    if (!order) {
      throw new AppError(404, "Delivery order not found");
    }

    return { order: this.serializeOrder(order, "user") };
  }

  async updateOrderStatus(orderId: string, status: DeliveryOrderStatus, role?: Role) {
    const order = await prisma.deliveryOrder.update({
      where: { id: orderId },
      data: { status },
      include: deliveryOrderInclude
    });

    if (order.partnerId && partnerAvailableStatuses.has(status)) {
      await prisma.deliveryPartner.update({
        where: { id: order.partnerId },
        data: {
          isAvailable: true,
          currentOrderId: null
        }
      });
    }

    if (status === DeliveryOrderStatus.READY_FOR_PICKUP) {
      // Trigger the broadcast helper you created in Step 3!
      void notifyAvailableRiders(
        "New Delivery Order Available",
        `Order ${order.orderNumber} is ready for pickup!`
      );
    }

    return { message: "Delivery order status updated", order: this.serializeOrder(order, role === "ADMIN" ? "admin" : "kitchen") };
  }



  async requestPartnerOtp(input: { name?: string; phone: string; vehicleType?: string }) {
    const phone = normalizePhone(input.phone);

    let partner = await prisma.deliveryPartner.findFirst({
      where: { phone },
      orderBy: { updatedAt: 'desc' }
    });

    if (partner) {
      if (input.name?.trim() || input.vehicleType?.trim()) {
        partner = await prisma.deliveryPartner.update({
          where: { id: partner.id },
          data: {
            name: input.name?.trim() || undefined,
            vehicleType: input.vehicleType?.trim() || undefined
          }
        });
      }
    } else {
      partner = await prisma.deliveryPartner.create({
        data: {
          name: input.name?.trim() || "Delivery Partner",
          phone,
          vehicleType: input.vehicleType?.trim() || "Bike"
        }
      });
    }

    return { message: "Delivery partner logged in", partnerId: partner.id, partner };
  }

  async verifyPartnerOtp(phone: string, _otp?: string) {
    const normalizedPhone = normalizePhone(phone);
    const partner = await prisma.deliveryPartner.findFirst({
      where: { phone: normalizedPhone },
      orderBy: { updatedAt: 'desc' }
    });
    if (!partner) {
      throw new AppError(404, "Delivery partner not found.");
    }

    return { message: "Delivery partner logged in", partner };
  }

  async requestKitchenOtp(phone: string) {
    const normalizedPhone = normalizePhone(phone);
    if (!env.KITCHEN_PHONE_NUMBER || normalizePhone(env.KITCHEN_PHONE_NUMBER) !== normalizedPhone) {
      throw new AppError(403, "This phone number is not allowed for kitchen login.");
    }

    return { message: "Kitchen logged in" };
  }

  async verifyKitchenOtp(phone: string, _otp?: string) {
    const normalizedPhone = normalizePhone(phone);
    if (!env.KITCHEN_PHONE_NUMBER || normalizePhone(env.KITCHEN_PHONE_NUMBER) !== normalizedPhone) {
      throw new AppError(403, "This phone number is not allowed for kitchen login.");
    }

    return { message: "Kitchen logged in" };
  }

  // Email + password kitchen login. Credentials live in env (KITCHEN_EMAIL /
  // KITCHEN_PASSWORD) for easy updates without touching the database.
  async loginKitchenWithPassword(email: string, password: string) {
    if (!env.KITCHEN_EMAIL || !env.KITCHEN_PASSWORD) {
      throw new AppError(503, "Kitchen login is not configured. Set KITCHEN_EMAIL and KITCHEN_PASSWORD.");
    }
    const emailMatches = email.trim().toLowerCase() === env.KITCHEN_EMAIL.toLowerCase();
    const passwordMatches = password === env.KITCHEN_PASSWORD;
    if (!emailMatches || !passwordMatches) {
      throw new AppError(401, "Invalid kitchen credentials.");
    }
    return { message: "Kitchen login successful" };
  }

  async registerKitchenPushToken(token: string) {
    await prisma.kitchenDevice.upsert({
      where: { pushToken: token },
      update: { updatedAt: new Date() },
      create: { pushToken: token }
    });
    return { message: "Push token registered successfully" };
  }
async unregisterKitchenPushToken(token: string) {
    // We use deleteMany to prevent an error if the token was already deleted
    await prisma.kitchenDevice.deleteMany({
      where: { pushToken: token }
    });
    return { message: "Kitchen device unregistered successfully" };
  }
  async getAvailablePartners() {
    const partners = await prisma.deliveryPartner.findMany({
      where: { isAvailable: true },
      orderBy: { createdAt: "desc" }
    });

    return { partners };
  }

  async updatePartnerAvailability(partnerId: string, isOnline: boolean) {
    const activeCount = await this.countActivePartnerOrders(partnerId);
    const partner = await prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: {
        isOnline,
        isAvailable: isOnline && activeCount < 2
      }
    });

    return { message: "Delivery partner availability updated", partner };
  }

  async getOpenOrdersForPartner() {
    const orders = await prisma.deliveryOrder.findMany({
      where: {
        partnerId: null,
        // Riders only see (and get buzzed for) orders the kitchen marked ready.
        status: DeliveryOrderStatus.READY_FOR_PICKUP
      },
      include: deliveryOrderInclude,
      orderBy: { createdAt: "asc" }
    });

    return { orders: this.serializeOrders(orders, "partner") };
  }

  async getPartnerOrders(partnerId: string) {
    const orders = await prisma.deliveryOrder.findMany({
      where: { partnerId },
      include: deliveryOrderInclude,
      orderBy: { createdAt: "desc" }
    });

    return { orders: this.serializeOrders(orders, "partner") };
  }

  private async countActivePartnerOrders(partnerId: string) {
    return prisma.deliveryOrder.count({
      where: {
        partnerId,
        status: { in: activePartnerStatuses }
      }
    });
  }

  private async refreshPartnerCapacity(partnerId: string, currentOrderId?: string | null) {
    const partner = await prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) return;

    const activeCount = await this.countActivePartnerOrders(partnerId);
    const data: Prisma.DeliveryPartnerUpdateInput = {
      isAvailable: partner.isOnline && activeCount < 2
    };

    if (currentOrderId !== undefined) {
      data.currentOrderId = currentOrderId;
    } else if (activeCount === 0) {
      data.currentOrderId = null;
    }

    await prisma.deliveryPartner.update({
      where: { id: partnerId },
      data
    });
  }

  async acceptOrder(orderId: string, partnerId: string) {
    const activeCount = await this.countActivePartnerOrders(partnerId);
    if (activeCount >= 2) {
      throw new AppError(400, "You can accept only 2 active orders at a time.");
    }

    const partner = await prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      throw new AppError(404, "Delivery partner not found.");
    }

    // DL verification guard — only APPROVED partners may accept deliveries
    if (partner.profileStatus !== "APPROVED") {
      const messages: Record<string, string> = {
        INCOMPLETE: "Your profile is incomplete. Please upload your Driver's License to get verified.",
        PENDING: "Your Driver's License is under review. You can accept deliveries once approved.",
        REJECTED: "Your verification was rejected. Please re-upload your Driver's License."
      };
      throw new AppError(403, messages[partner.profileStatus] ?? "Your account is not verified.");
    }

    const existingOrder = await prisma.deliveryOrder.findUnique({ where: { id: orderId } });
    if (!existingOrder) {
      throw new AppError(404, "Delivery order not found.");
    }
    if (existingOrder.partnerId && existingOrder.partnerId !== partnerId) {
      throw new AppError(400, "This order is already accepted by another partner.");
    }
    if (partnerAvailableStatuses.has(existingOrder.status)) {
      throw new AppError(400, "This order is already closed.");
    }

    const order = await prisma.deliveryOrder.update({
      where: { id: orderId },
      data: {
        partnerId,
        // Record the assignment time the first time a rider takes the order.
        assignedAt: existingOrder.assignedAt ?? new Date(),
        status: existingOrder.status === DeliveryOrderStatus.PENDING ? DeliveryOrderStatus.ACCEPTED : existingOrder.status
      },
      include: deliveryOrderInclude
    });

    await this.refreshPartnerCapacity(partnerId, order.id);
    return { message: "Delivery order accepted", order: this.serializeOrder(order, "partner") };
  }

  async assignPartner(orderId: string, partnerId: string) {
    const res = await this.acceptOrder(orderId, partnerId);
    const partner = await prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
      select: { pushToken: true }
    });
    if (partner?.pushToken) {
      await sendPushNotifications(
        [partner.pushToken],
        "Order Assigned",
        `Order ${res.order.orderNumber} has been assigned to you!`,
        { orderId },
        'high-priority-orders'
      ).catch((e) => console.error("Failed to send assignment push notification", e));
    }
    return res;
  }

  // Kitchen removes the current rider → order goes back into the ready pool so it
  // re-broadcasts to all online riders (or the kitchen can then assign a specific one).
  async unassignPartner(orderId: string) {
    const current = await prisma.deliveryOrder.findUnique({ where: { id: orderId } });
    if (!current) {
      throw new AppError(404, "Delivery order not found.");
    }
    const previousPartnerId = current.partnerId;
    const order = await prisma.deliveryOrder.update({
      where: { id: orderId },
      data: {
        partnerId: null,
        assignedAt: null,
        status: DeliveryOrderStatus.READY_FOR_PICKUP
      },
      include: deliveryOrderInclude
    });
    if (previousPartnerId) {
      await this.refreshPartnerCapacity(previousPartnerId);
    }
    return { message: "Rider removed from order.", order: this.serializeOrder(order, "kitchen") };
  }

  // Kitchen assigns a specific rider (push-assign, overriding any current rider).
  async forceAssignPartner(orderId: string, partnerId: string) {
    const partner = await prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      throw new AppError(404, "Delivery partner not found.");
    }
    if (partner.profileStatus !== "APPROVED") {
      throw new AppError(400, "This rider is not verified yet.");
    }
    const current = await prisma.deliveryOrder.findUnique({ where: { id: orderId } });
    if (!current) {
      throw new AppError(404, "Delivery order not found.");
    }
    if (partnerAvailableStatuses.has(current.status)) {
      throw new AppError(400, "This order is already closed.");
    }
    const previousPartnerId = current.partnerId && current.partnerId !== partnerId ? current.partnerId : null;

    const order = await prisma.deliveryOrder.update({
      where: { id: orderId },
      data: {
        partnerId,
        assignedAt: new Date(),
        status: current.status === DeliveryOrderStatus.PENDING ? DeliveryOrderStatus.ACCEPTED : current.status
      },
      include: deliveryOrderInclude
    });

    await this.refreshPartnerCapacity(partnerId, order.id);
    if (previousPartnerId) {
      await this.refreshPartnerCapacity(previousPartnerId);
    }

    if (partner.pushToken) {
      await sendPushNotifications(
        [partner.pushToken],
        "Order Assigned",
        `Order ${order.orderNumber} has been assigned to you by the kitchen!`,
        { orderId },
        "high-priority-orders"
      ).catch((e) => console.error("Failed to send assignment push notification", e));
    }

    return { message: "Rider assigned to order.", order: this.serializeOrder(order, "kitchen") };
  }

  private assertPartnerOrder(order: DeliveryOrder | null, partnerId: string) {
    if (!order) {
      throw new AppError(404, "Delivery order not found.");
    }
    if (order.partnerId !== partnerId) {
      throw new AppError(403, "This order is not assigned to this delivery partner.");
    }
  }

  // Rider enters the pickup OTP shown on the kitchen's order → confirms pickup
  // and starts the delivery in one step (→ OUT_FOR_DELIVERY).
  async pickupWithOtp(orderId: string, partnerId: string, otp?: string) {
    const current = await prisma.deliveryOrder.findUnique({ where: { id: orderId } });
    this.assertPartnerOrder(current, partnerId);
    const allowed: DeliveryOrderStatus[] = [
      DeliveryOrderStatus.ACCEPTED,
      DeliveryOrderStatus.PREPARING,
      DeliveryOrderStatus.READY_FOR_PICKUP,
      DeliveryOrderStatus.PICKED_UP
    ];
    if (!current || !allowed.includes(current.status)) {
      throw new AppError(400, "This order can't be picked up right now.");
    }
    if (current.pickupOtp && (otp ?? "").trim() !== current.pickupOtp) {
      throw new AppError(400, "Incorrect pickup OTP. Ask the kitchen for the code shown on the order.");
    }

    const order = await prisma.deliveryOrder.update({
      where: { id: orderId },
      data: { status: DeliveryOrderStatus.OUT_FOR_DELIVERY },
      include: deliveryOrderInclude
    });

    return { message: "Picked up — delivery started", order: this.serializeOrder(order, "partner") };
  }

  async markPickedUp(orderId: string, partnerId: string) {
    const current = await prisma.deliveryOrder.findUnique({ where: { id: orderId } });
    this.assertPartnerOrder(current, partnerId);
    const pickupAllowedStatuses: DeliveryOrderStatus[] = [
      DeliveryOrderStatus.ACCEPTED,
      DeliveryOrderStatus.PREPARING,
      DeliveryOrderStatus.READY_FOR_PICKUP
    ];
    if (!current || !pickupAllowedStatuses.includes(current.status)) {
      throw new AppError(400, "Order is not ready for pickup.");
    }

    const order = await prisma.deliveryOrder.update({
      where: { id: orderId },
      data: { status: DeliveryOrderStatus.PICKED_UP },
      include: deliveryOrderInclude
    });

    return { message: "Order marked picked up", order: this.serializeOrder(order, "partner") };
  }

  async startDelivery(orderId: string, partnerId: string) {
    const current = await prisma.deliveryOrder.findUnique({ where: { id: orderId } });
    this.assertPartnerOrder(current, partnerId);
    if (current?.status !== DeliveryOrderStatus.PICKED_UP) {
      throw new AppError(400, "Pickup must be verified before starting delivery.");
    }

    const order = await prisma.deliveryOrder.update({
      where: { id: orderId },
      data: { status: DeliveryOrderStatus.OUT_FOR_DELIVERY },
      include: deliveryOrderInclude
    });

    return { message: "Delivery route started", order: this.serializeOrder(order, "partner") };
  }

  async markDelivered(orderId: string, partnerId: string, otp?: string) {
    const current = await prisma.deliveryOrder.findUnique({ where: { id: orderId } });
    this.assertPartnerOrder(current, partnerId);
    const deliveryAllowedStatuses: DeliveryOrderStatus[] = [DeliveryOrderStatus.PICKED_UP, DeliveryOrderStatus.OUT_FOR_DELIVERY];
    if (!current || !deliveryAllowedStatuses.includes(current.status)) {
      throw new AppError(400, "Start delivery before marking this order delivered.");
    }

    // The customer reads out the delivery OTP; the rider must enter it to complete.
    if (current.deliveryOtp && (otp ?? "").trim() !== current.deliveryOtp) {
      throw new AppError(400, "Incorrect delivery OTP. Ask the customer for the code shown on their order.");
    }

    const order = await prisma.deliveryOrder.update({
      where: { id: orderId },
      data: { status: DeliveryOrderStatus.DELIVERED },
      include: deliveryOrderInclude
    });

    await this.refreshPartnerCapacity(partnerId);
    return { message: "Delivery completed", order: this.serializeOrder(order, "partner") };
  }

  async getKitchenOrders() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const orders = await prisma.deliveryOrder.findMany({
      where: {
        OR: [
          // Active orders (anything not finished)
          { status: { notIn: [DeliveryOrderStatus.DELIVERED, DeliveryOrderStatus.CANCELLED] } },
          // Plus today's completed orders for the kitchen's success list
          {
            status: { in: [DeliveryOrderStatus.DELIVERED, DeliveryOrderStatus.CANCELLED] },
            updatedAt: { gte: startOfToday }
          }
        ]
      },
      include: deliveryOrderInclude,
      orderBy: { createdAt: "asc" }
    });

    return { orders: this.serializeOrders(orders, "kitchen") };
  }

  async getKitchenItems(category?: DeliveryCategory) {
    const items = await prisma.deliveryItem.findMany({
      where: {
        ...(category ? { category } : {})
      },
      orderBy: [{ category: "asc" }, { grocerySection: "asc" }, { name: "asc" }] as Prisma.DeliveryItemOrderByWithRelationInput[]
    });

    return { items };
  }

  async updateItemInventory(itemId: string, input: { availableQuantity: number; isAvailable?: boolean }) {
    const item = await prisma.deliveryItem.update({
      where: { id: itemId },
      data: {
        availableQuantity: input.availableQuantity,
        isAvailable: input.isAvailable ?? input.availableQuantity > 0
      }
    });

    return { message: "Delivery item inventory updated", item };
  }

  async createKitchenItem(input: DeliveryItemPayloadInput) {
    const item = await prisma.deliveryItem.create({
      data: {
        name: input.name.trim(),
        price: input.price,
        imageUrl: input.imageUrl?.trim() || null,
        category: input.category,
        grocerySection: input.category === DeliveryCategory.GROCERY ? input.grocerySection?.trim() || "Daily Essentials" : null,
        servingInfo: input.servingInfo?.trim() || null,
        pieces: input.pieces?.trim() || null,
        isVeg: input.category === DeliveryCategory.FOOD ? (input.isVeg ?? true) : true,
        availableQuantity: input.availableQuantity,
        isAvailable: input.isAvailable ?? input.availableQuantity > 0
      } as Prisma.DeliveryItemUncheckedCreateInput
    });

    return { message: "Delivery item created", item };
  }

  async updateKitchenItem(itemId: string, input: DeliveryItemPayloadInput) {
    const item = await prisma.deliveryItem.update({
      where: { id: itemId },
      data: {
        name: input.name.trim(),
        price: input.price,
        imageUrl: input.imageUrl?.trim() || null,
        category: input.category,
        grocerySection: input.category === DeliveryCategory.GROCERY ? input.grocerySection?.trim() || "Daily Essentials" : null,
        servingInfo: input.servingInfo?.trim() || null,
        pieces: input.pieces?.trim() || null,
        isVeg: input.category === DeliveryCategory.FOOD ? (input.isVeg ?? true) : true,
        availableQuantity: input.availableQuantity,
        isAvailable: input.isAvailable ?? input.availableQuantity > 0
      } as Prisma.DeliveryItemUncheckedUpdateInput
    });

    return { message: "Delivery item updated", item };
  }

  async updatePartnerLocation(partnerId: string, lat: number, lng: number) {
    const partner = await prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: {
        currentLat: lat,
        currentLng: lng
      }
    });

    return { message: "Delivery partner location updated", partner };
  }

  // ─── DL Verification ─────────────────────────────────────────────────────

  /** Partner uploads their DL image URL → status moves to PENDING */
  async uploadPartnerDl(partnerId: string, dlUrl: string) {
    const partner = await prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      throw new AppError(404, "Delivery partner not found.");
    }

    const updated = await prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: {
        dlUrl,
        profileStatus: "PENDING"
      }
    });

    notifyAdminPartnerApplication({
      partnerName: updated.name ?? 'Unknown',
      phone: updated.phone ?? 'No phone',
      vehicleType: updated.vehicleType
    });

    return { message: "Driver's License submitted for review.", partner: updated };
  }

  // Lets a partner whose application is still INCOMPLETE (no documents submitted)
  // delete their account, freeing the email so it can be used as a customer.
  async deletePartnerAccount(partnerId: string) {
    const partner = await prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      throw new AppError(404, "Delivery partner not found.");
    }
    if (partner.profileStatus !== "INCOMPLETE") {
      throw new AppError(403, "You can't delete this account after submitting your documents. Contact support if needed.");
    }

    const userId = partner.userId;
    await prisma.$transaction(async (tx) => {
      // Remove the FK reference first, then the linked user (cascades sessions).
      await tx.deliveryPartner.delete({ where: { id: partnerId } });
      if (userId) {
        await tx.user.delete({ where: { id: userId } });
      }
    });

    return { message: "Delivery partner account deleted. This email is now free to use." };
  }

  /** Admin: fetch all partners awaiting verification */
  async getPendingPartners() {
    const partners = await prisma.deliveryPartner.findMany({
      where: { profileStatus: "PENDING" },
      include: {
        orders: {
          where: { status: DeliveryOrderStatus.DELIVERED },
          select: { partnerCut: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    const enrichedPartners = partners.map(partner => {
      const deliveredCount = partner.orders.length;
      const totalEarnings = partner.orders.reduce((sum, order) => sum + (order.partnerCut ?? 0), 0);

      const { orders, ...rest } = partner;
      return {
        ...rest,
        deliveredCount,
        totalEarnings
      };
    });

    return { partners: enrichedPartners };
  }

  /** Admin: fetch all partners */
  async getAllPartners() {
    const partners = await prisma.deliveryPartner.findMany({
      include: {
        orders: {
          where: { status: DeliveryOrderStatus.DELIVERED },
          select: { partnerCut: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    const enrichedPartners = partners.map(partner => {
      const deliveredCount = partner.orders.length;
      const totalEarnings = partner.orders.reduce((sum, order) => sum + (order.partnerCut ?? 0), 0);

      const { orders, ...rest } = partner;
      return {
        ...rest,
        deliveredCount,
        totalEarnings
      };
    });

    return { partners: enrichedPartners };
  }

  /** Admin: approve or reject a partner */
  async verifyPartner(partnerId: string, decision: "APPROVED" | "REJECTED", reason?: string) {
    const partner = await prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      throw new AppError(404, "Delivery partner not found.");
    }
    if (partner.profileStatus !== "PENDING") {
      throw new AppError(400, "Partner is not in PENDING state.");
    }

    const newStatus = decision === "APPROVED" ? "APPROVED" : "REJECTED";

    if (newStatus === "APPROVED") {
      const existingApproved = await prisma.deliveryPartner.findFirst({
        where: { phone: partner.phone, profileStatus: "APPROVED", id: { not: partnerId } }
      });
      if (existingApproved) {
        throw new AppError(400, "Another partner is already approved with this phone number.");
      }

      await prisma.deliveryPartner.updateMany({
        where: { phone: partner.phone, id: { not: partnerId } },
        data: { profileStatus: "REJECTED" }
      });
    }

    const updated = await prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: {
        profileStatus: newStatus,
        rejectionReason: newStatus === "REJECTED" ? (reason?.trim() || "Your document was unclear or invalid. Please upload a new, legible photo.") : null
      }
    });

    return {
      message: decision === "APPROVED" ? "Partner approved." : "Partner rejected — they must re-upload their DL.",
      partner: updated
    };
  }

  // ─── Payout & Earnings ───────────────────────────────────────────────────

  async getPartnerEarnings(partnerId: string) {
    const orders = await prisma.deliveryOrder.findMany({
      where: {
        partnerId,
        status: DeliveryOrderStatus.DELIVERED
      },
      select: {
        partnerCut: true,
        isPayoutCleared: true
      }
    });

    const unpaid = orders
      .filter((o) => !o.isPayoutCleared)
      .reduce((sum, o) => sum + o.partnerCut, 0);

    const lifetime = orders.reduce((sum, o) => sum + o.partnerCut, 0);

    const partner = await prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
      select: { upiId: true, payoutRequestedAt: true }
    });

    if (!partner) {
      throw new AppError(404, "Partner not found");
    }

    return { unpaid, lifetime, upiId: partner.upiId, payoutRequestedAt: partner.payoutRequestedAt };
  }

  async updatePartnerUpi(partnerId: string, upiId: string) {
    const partner = await prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: { upiId }
    });
    return { message: "UPI ID updated", partner };
  }

  async requestPartnerPayout(partnerId: string) {
    const partner = await prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: { payoutRequestedAt: new Date() }
    });
    return { message: "Payout requested", partner };
  }

  async getDeliveryConfig() {
    let config = await prisma.deliveryConfig.findUnique({ where: { id: "default" } });
    if (!config) {
      config = await prisma.deliveryConfig.create({
        data: {
          id: "default",
          baseDeliveryFee: 30,
          deliveryFeePerKm: 15,
          freeDeliveryThreshold: 500,
          defaultRiderCut: 50
        }
      });
    }
    return config;
  }

  calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const deliveryService = new DeliveryService();
