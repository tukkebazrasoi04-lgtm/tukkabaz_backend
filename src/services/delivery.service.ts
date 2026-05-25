import { DeliveryCategory, DeliveryOrderStatus, PaymentStatus, type DeliveryOrder, type Prisma, type Role } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import type { CreateDeliveryOrderInput, CreateDeliveryPartnerInput, DeliveryItemPayloadInput } from "../validators/delivery.validator";
import { normalizePhone } from "./otp.service";

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
  private serializeOrder<T extends DeliveryOrder & { partner?: unknown; user?: unknown }>(order: T, _visibility: OtpVisibility) {
    return {
      ...order,
      pickupOtp: null,
      deliveryOtp: null,
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

    const totalAmount = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

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

      const orderCount = await tx.deliveryOrder.count();
      const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(6, "0")}`;

      const orderData = {
        orderNumber,
        userId,
        items: orderItems as Prisma.InputJsonValue,
        totalAmount,
        paymentProvider: input.paymentProvider?.trim() || "SIMULATED",
        paymentReference: input.paymentReference?.trim() || null,
        paymentStatus: input.paymentStatus ?? (input.paymentReference ? PaymentStatus.SUCCESS : PaymentStatus.PENDING),
        status: DeliveryOrderStatus.PENDING,
        deliveryAddress: input.deliveryAddress.trim(),
        customerPhone,
        destinationLat: input.destinationLat,
        destinationLng: input.destinationLng,
        pickupOtp: null,
        deliveryOtp: null
      } as unknown as Prisma.DeliveryOrderUncheckedCreateInput;

      return tx.deliveryOrder.create({
        data: orderData,
        include: deliveryOrderInclude
      });
    });

    return { message: "Delivery order placed", order: this.serializeOrder(order, "user") };
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

    return { message: "Delivery order status updated", order: this.serializeOrder(order, role === "ADMIN" ? "admin" : "kitchen") };
  }

  async createPartner(input: CreateDeliveryPartnerInput) {
    const partner = await prisma.deliveryPartner.upsert({
      where: { phone: input.phone.trim() },
      update: {
        name: input.name.trim(),
        vehicleType: input.vehicleType.trim(),
        currentLat: input.currentLat,
        currentLng: input.currentLng
      },
      create: {
        name: input.name.trim(),
        phone: input.phone.trim(),
        vehicleType: input.vehicleType.trim(),
        currentLat: input.currentLat,
        currentLng: input.currentLng
      }
    });

    return { message: "Delivery partner created", partner };
  }

  async requestPartnerOtp(input: { name?: string; phone: string; vehicleType?: string }) {
    const phone = normalizePhone(input.phone);

    const partner = await prisma.deliveryPartner.upsert({
      where: { phone },
      update: {
        name: input.name?.trim() || undefined,
        vehicleType: input.vehicleType?.trim() || undefined
      },
      create: {
        name: input.name?.trim() || "Delivery Partner",
        phone,
        vehicleType: input.vehicleType?.trim() || "Bike"
      }
    });

    return { message: "Delivery partner logged in", partnerId: partner.id, partner };
  }

  async verifyPartnerOtp(phone: string, _otp?: string) {
    const normalizedPhone = normalizePhone(phone);
    const partner = await prisma.deliveryPartner.findUnique({ where: { phone: normalizedPhone } });
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

  async getAvailablePartners() {
    const partners = await prisma.deliveryPartner.findMany({
      where: { isAvailable: true },
      orderBy: { createdAt: "desc" }
    });

    return { partners };
  }

  async updatePartnerAvailability(partnerId: string, isAvailable: boolean) {
    const partner = await prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: { isAvailable }
    });

    return { message: "Delivery partner availability updated", partner };
  }

  async getOpenOrdersForPartner() {
    const orders = await prisma.deliveryOrder.findMany({
      where: {
        partnerId: null,
        status: {
          in: [
            DeliveryOrderStatus.PENDING,
            DeliveryOrderStatus.ACCEPTED,
            DeliveryOrderStatus.PREPARING,
            DeliveryOrderStatus.READY_FOR_PICKUP
          ]
        }
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
    const activeCount = await this.countActivePartnerOrders(partnerId);
    const data: Prisma.DeliveryPartnerUpdateInput = {
      isAvailable: activeCount < 2
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
        status: existingOrder.status === DeliveryOrderStatus.PENDING ? DeliveryOrderStatus.ACCEPTED : existingOrder.status
      },
      include: deliveryOrderInclude
    });

    await this.refreshPartnerCapacity(partnerId, order.id);
    return { message: "Delivery order accepted", order: this.serializeOrder(order, "partner") };
  }

  async assignPartner(orderId: string, partnerId: string) {
    return this.acceptOrder(orderId, partnerId);
  }

  private assertPartnerOrder(order: DeliveryOrder | null, partnerId: string) {
    if (!order) {
      throw new AppError(404, "Delivery order not found.");
    }
    if (order.partnerId !== partnerId) {
      throw new AppError(403, "This order is not assigned to this delivery partner.");
    }
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

  async markDelivered(orderId: string, partnerId: string) {
    const current = await prisma.deliveryOrder.findUnique({ where: { id: orderId } });
    this.assertPartnerOrder(current, partnerId);
    const deliveryAllowedStatuses: DeliveryOrderStatus[] = [DeliveryOrderStatus.PICKED_UP, DeliveryOrderStatus.OUT_FOR_DELIVERY];
    if (!current || !deliveryAllowedStatuses.includes(current.status)) {
      throw new AppError(400, "Start delivery before marking this order delivered.");
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
    const orders = await prisma.deliveryOrder.findMany({
      where: {
        status: { notIn: [DeliveryOrderStatus.DELIVERED, DeliveryOrderStatus.CANCELLED] }
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
        description: input.description.trim(),
        price: input.price,
        imageUrl: input.imageUrl?.trim() || null,
        category: input.category,
        grocerySection: input.category === DeliveryCategory.GROCERY ? input.grocerySection?.trim() || "Daily Essentials" : null,
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
        description: input.description.trim(),
        price: input.price,
        imageUrl: input.imageUrl?.trim() || null,
        category: input.category,
        grocerySection: input.category === DeliveryCategory.GROCERY ? input.grocerySection?.trim() || "Daily Essentials" : null,
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
}

export const deliveryService = new DeliveryService();
