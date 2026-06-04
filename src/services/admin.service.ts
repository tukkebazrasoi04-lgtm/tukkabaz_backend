import { BookingKind, PaymentStatus, ServiceType, DeliveryOrderStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";

type UpsertRoomInput = {
  title: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  imageUrls?: string[];
  roomPhotoTypes?: string[];
  roomPhotos?: Prisma.InputJsonValue;
  address?: string | null;
  ownerPhone?: string | null;
  tags?: string[];
  amenities?: string[];
  unavailableAmenities?: string[];
  sleepTitle?: string | null;
  sleepDescription?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googleMapUrl?: string | null;
  capacity?: number;
  available?: boolean;
};

type UpsertServiceInput = {
  title: string;
  description: string;
  price: number;
  type: ServiceType;
  imageUrl?: string | null;
  imageUrls?: string[];
  detailSections?: Prisma.InputJsonValue;
  activityOptions?: Prisma.InputJsonValue;
  requiredDocuments?: string[];
  pickupAddress?: string | null;
  contactPhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ctaLabel?: string | null;
  googleMapUrl?: string | null;
  available?: boolean;
};

const normalizeNullableString = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeCoordinate = (value: number | null | undefined): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return Number.isFinite(value) ? value : null;
};

const normalizeTags = (tags: string[] | undefined): string[] | undefined => {
  if (tags === undefined) {
    return undefined;
  }

  const seen = new Set<string>();
  return tags
    .map((tag) => tag.trim().replace(/\s+/g, " "))
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const normalizeImageUrls = (imageUrls: string[] | undefined, fallback?: string | null): string[] | undefined => {
  if (imageUrls === undefined) {
    return fallback ? [fallback] : undefined;
  }

  const seen = new Set<string>();
  return imageUrls
    .map((url) => url.trim())
    .filter((url) => {
      if (!url || seen.has(url)) {
        return false;
      }
      seen.add(url);
      return true;
    });
};

const buildRoomPhotos = (
  roomPhotos: Prisma.InputJsonValue | undefined,
  imageUrls: string[] | undefined,
  roomPhotoTypes: string[] | undefined,
  fallbackType = "Bedroom"
): Prisma.InputJsonValue | undefined => {
  if (roomPhotos !== undefined) {
    return roomPhotos;
  }

  if (imageUrls === undefined) {
    return undefined;
  }

  return imageUrls.map((url, index) => ({
    url,
    type: roomPhotoTypes?.[index] ?? (index === 0 ? fallbackType : `Photo ${index + 1}`)
  }));
};

class AdminService {
  async getRooms() {
    const rooms = await prisma.room.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return { rooms };
  }

  async getServices() {
    const services = await prisma.service.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return { services };
  }

  async createRoom(input: UpsertRoomInput) {
    const imageUrl = normalizeNullableString(input.imageUrl);
    const address = normalizeNullableString(input.address);
    const ownerPhone = normalizeNullableString(input.ownerPhone);
    const tags = normalizeTags(input.tags);
    const amenities = normalizeTags(input.amenities);
    const unavailableAmenities = normalizeTags(input.unavailableAmenities);
    const sleepTitle = normalizeNullableString(input.sleepTitle);
    const sleepDescription = normalizeNullableString(input.sleepDescription);
    const imageUrls = normalizeImageUrls(input.imageUrls, imageUrl);
    const roomPhotoTypes = normalizeTags(input.roomPhotoTypes);
    const roomPhotos = buildRoomPhotos(input.roomPhotos, imageUrls, roomPhotoTypes, sleepTitle ?? "Bedroom");
    const latitude = normalizeCoordinate(input.latitude);
    const longitude = normalizeCoordinate(input.longitude);
    const googleMapUrl = normalizeNullableString(input.googleMapUrl);

    const room = await prisma.room.create({
      data: {
        title: input.title,
        description: input.description,
        price: input.price,
        imageUrl: imageUrl ?? null,
        imageUrls: imageUrls ?? [],
        roomPhotoTypes: roomPhotoTypes ?? [],
        roomPhotos: roomPhotos ?? [],
        address: address ?? null,
        ownerPhone: ownerPhone ?? null,
        tags: tags ?? [],
        amenities: amenities ?? [],
        unavailableAmenities: unavailableAmenities ?? [],
        sleepTitle: sleepTitle ?? null,
        sleepDescription: sleepDescription ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        googleMapUrl: googleMapUrl ?? null,
        capacity: input.capacity ?? 2,
        available: input.available ?? true
      } as Prisma.RoomUncheckedCreateInput
    });

    return { message: "Room created", room };
  }

  async updateRoom(id: string, input: UpsertRoomInput) {
    const existing = await prisma.room.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Room not found");
    }
    const existingRoom = existing as typeof existing & {
      amenities: string[];
      unavailableAmenities: string[];
      sleepTitle: string | null;
      sleepDescription: string | null;
      roomPhotoTypes: string[];
      roomPhotos: Prisma.JsonValue;
    };

    const imageUrl = normalizeNullableString(input.imageUrl);
    const address = normalizeNullableString(input.address);
    const ownerPhone = normalizeNullableString(input.ownerPhone);
    const tags = normalizeTags(input.tags);
    const amenities = normalizeTags(input.amenities);
    const unavailableAmenities = normalizeTags(input.unavailableAmenities);
    const sleepTitle = normalizeNullableString(input.sleepTitle);
    const sleepDescription = normalizeNullableString(input.sleepDescription);
    const imageUrls = normalizeImageUrls(input.imageUrls, imageUrl === undefined ? undefined : imageUrl);
    const roomPhotoTypes = normalizeTags(input.roomPhotoTypes);
    const nextImageUrls = imageUrls === undefined ? existing.imageUrls : imageUrls;
    const nextPhotoTypes = roomPhotoTypes === undefined ? existingRoom.roomPhotoTypes : roomPhotoTypes;
    const roomPhotos = buildRoomPhotos(input.roomPhotos, imageUrls, nextPhotoTypes, sleepTitle ?? existingRoom.sleepTitle ?? "Bedroom");
    const existingRoomPhotos = existingRoom.roomPhotos === null ? [] : (existingRoom.roomPhotos as Prisma.InputJsonValue);
    const latitude = normalizeCoordinate(input.latitude);
    const longitude = normalizeCoordinate(input.longitude);
    const googleMapUrl = normalizeNullableString(input.googleMapUrl);

    const room = await prisma.room.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        price: input.price,
        imageUrl: imageUrl === undefined ? existing.imageUrl : imageUrl,
        imageUrls: nextImageUrls,
        roomPhotoTypes: nextPhotoTypes,
        roomPhotos: roomPhotos === undefined ? existingRoomPhotos : roomPhotos,
        address: address === undefined ? existing.address : address,
        ownerPhone: ownerPhone === undefined ? existing.ownerPhone : ownerPhone,
        tags: tags === undefined ? existing.tags : tags,
        amenities: amenities === undefined ? existingRoom.amenities : amenities,
        unavailableAmenities: unavailableAmenities === undefined ? existingRoom.unavailableAmenities : unavailableAmenities,
        sleepTitle: sleepTitle === undefined ? existingRoom.sleepTitle : sleepTitle,
        sleepDescription: sleepDescription === undefined ? existingRoom.sleepDescription : sleepDescription,
        latitude: latitude === undefined ? existing.latitude : latitude,
        longitude: longitude === undefined ? existing.longitude : longitude,
        googleMapUrl: googleMapUrl === undefined ? (existing as any).googleMapUrl : googleMapUrl,
        capacity: input.capacity ?? existing.capacity,
        available: input.available ?? existing.available
      } as Prisma.RoomUncheckedUpdateInput
    });

    return { message: "Room updated", room };
  }

  async deleteRoom(id: string) {
    const existing = await prisma.room.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Room not found");
    }

    await prisma.room.delete({ where: { id } });
    return { message: "Room deleted" };
  }

  async createService(input: UpsertServiceInput) {
    const imageUrl = normalizeNullableString(input.imageUrl);
    const imageUrls = normalizeImageUrls(input.imageUrls, imageUrl);
    const requiredDocuments = normalizeTags(input.requiredDocuments);
    const pickupAddress = normalizeNullableString(input.pickupAddress);
    const contactPhone = normalizeNullableString(input.contactPhone);
    const latitude = normalizeCoordinate(input.latitude);
    const longitude = normalizeCoordinate(input.longitude);
    const ctaLabel = normalizeNullableString(input.ctaLabel);
    const googleMapUrl = normalizeNullableString(input.googleMapUrl);

    const service = await prisma.service.create({
      data: {
        title: input.title,
        description: input.description,
        price: input.price,
        type: input.type,
        imageUrl: imageUrl ?? null,
        imageUrls: imageUrls ?? [],
        detailSections: input.detailSections ?? [],
        activityOptions: input.activityOptions ?? [],
        requiredDocuments: requiredDocuments ?? [],
        pickupAddress: pickupAddress ?? null,
        contactPhone: contactPhone ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        ctaLabel: ctaLabel ?? null,
        googleMapUrl: googleMapUrl ?? null,
        available: input.available ?? true
      } as Prisma.ServiceUncheckedCreateInput
    });

    return { message: "Service created", service };
  }

  async updateService(id: string, input: UpsertServiceInput) {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Service not found");
    }
    const existingService = existing as typeof existing & {
      imageUrls: string[];
      detailSections: Prisma.JsonValue;
      activityOptions: Prisma.JsonValue;
      requiredDocuments: string[];
      pickupAddress: string | null;
      contactPhone: string | null;
      latitude: number | null;
      longitude: number | null;
      ctaLabel: string | null;
    };

    const imageUrl = normalizeNullableString(input.imageUrl);
    const imageUrls = normalizeImageUrls(input.imageUrls, imageUrl === undefined ? undefined : imageUrl);
    const requiredDocuments = normalizeTags(input.requiredDocuments);
    const pickupAddress = normalizeNullableString(input.pickupAddress);
    const contactPhone = normalizeNullableString(input.contactPhone);
    const latitude = normalizeCoordinate(input.latitude);
    const longitude = normalizeCoordinate(input.longitude);
    const ctaLabel = normalizeNullableString(input.ctaLabel);
    const googleMapUrl = normalizeNullableString(input.googleMapUrl);
    const existingDetailSections = existingService.detailSections === null
      ? []
      : (existingService.detailSections as Prisma.InputJsonValue);
    const existingActivityOptions = existingService.activityOptions === null
      ? []
      : (existingService.activityOptions as Prisma.InputJsonValue);

    const service = await prisma.service.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        price: input.price,
        type: input.type,
        imageUrl: imageUrl === undefined ? existing.imageUrl : imageUrl,
        imageUrls: imageUrls === undefined ? existingService.imageUrls : imageUrls,
        detailSections: input.detailSections === undefined ? existingDetailSections : input.detailSections,
        activityOptions: input.activityOptions === undefined ? existingActivityOptions : input.activityOptions,
        requiredDocuments: requiredDocuments === undefined ? existingService.requiredDocuments : requiredDocuments,
        pickupAddress: pickupAddress === undefined ? existingService.pickupAddress : pickupAddress,
        contactPhone: contactPhone === undefined ? existingService.contactPhone : contactPhone,
        latitude: latitude === undefined ? existingService.latitude : latitude,
        longitude: longitude === undefined ? existingService.longitude : longitude,
        ctaLabel: ctaLabel === undefined ? existingService.ctaLabel : ctaLabel,
        googleMapUrl: googleMapUrl === undefined ? (existingService as any).googleMapUrl : googleMapUrl,
        available: input.available ?? existing.available
      } as Prisma.ServiceUncheckedUpdateInput
    });

    return { message: "Service updated", service };
  }

  async deleteService(id: string) {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "Service not found");
    }

    await prisma.service.delete({ where: { id } });
    return { message: "Service deleted" };
  }

  async getAnalytics(options?: { period?: string; status?: string }) {
    const period = options?.period;
    const status = options?.status;

    let dateFilter: { gte?: Date } | undefined = undefined;
    const now = new Date();
    if (period === "day") {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { gte: startOfToday };
    } else if (period === "week") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      dateFilter = { gte: oneWeekAgo };
    } else if (period === "month") {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(now.getMonth() - 1);
      dateFilter = { gte: oneMonthAgo };
    }

    const bookingWhere: Prisma.BookingWhereInput = {};
    if (status && status !== "ALL") {
      bookingWhere.paymentStatus = status as PaymentStatus;
    }
    if (dateFilter) {
      bookingWhere.createdAt = dateFilter;
    }

    const deliveryWhere: Prisma.DeliveryOrderWhereInput = {};
    if (status && status !== "ALL") {
      deliveryWhere.paymentStatus = status as PaymentStatus;
    }
    if (dateFilter) {
      deliveryWhere.createdAt = dateFilter;
    }

    const isSuccessCompatible = !status || status === "ALL" || status === "SUCCESS";

    const [
      totalBookings,
      successfulBookings,
      roomSuccessCount,
      serviceSuccessCount,
      revenue,
      totalDeliveryOrders,
      successfulDeliveryOrders,
      deliveryRevenue
    ] = await Promise.all([
      prisma.booking.count({ where: bookingWhere }),
      isSuccessCompatible
        ? prisma.booking.count({ where: { createdAt: dateFilter, paymentStatus: PaymentStatus.SUCCESS } })
        : Promise.resolve(0),
      isSuccessCompatible
        ? prisma.booking.count({ where: { createdAt: dateFilter, paymentStatus: PaymentStatus.SUCCESS, kind: BookingKind.ROOM } })
        : Promise.resolve(0),
      isSuccessCompatible
        ? prisma.booking.count({ where: { createdAt: dateFilter, paymentStatus: PaymentStatus.SUCCESS, kind: BookingKind.SERVICE } })
        : Promise.resolve(0),
      isSuccessCompatible
        ? prisma.booking.aggregate({ where: { createdAt: dateFilter, paymentStatus: PaymentStatus.SUCCESS }, _sum: { amount: true } })
        : Promise.resolve({ _sum: { amount: null } }),
      prisma.deliveryOrder.count({ where: deliveryWhere }),
      isSuccessCompatible
        ? prisma.deliveryOrder.count({ where: { createdAt: dateFilter, paymentStatus: PaymentStatus.SUCCESS } })
        : Promise.resolve(0),
      isSuccessCompatible
        ? prisma.deliveryOrder.aggregate({ where: { createdAt: dateFilter, paymentStatus: PaymentStatus.SUCCESS }, _sum: { totalAmount: true } })
        : Promise.resolve({ _sum: { totalAmount: null } })
    ]);

    const [roomBreakdownRaw, serviceBreakdownRaw] = await Promise.all([
      isSuccessCompatible
        ? prisma.booking.groupBy({
            by: ["roomId"],
            where: {
              createdAt: dateFilter,
              paymentStatus: PaymentStatus.SUCCESS,
              kind: BookingKind.ROOM,
              roomId: { not: null }
            },
            _count: { _all: true },
            _sum: { amount: true },
            orderBy: { _count: { roomId: "desc" } }
          })
        : Promise.resolve([]),
      isSuccessCompatible
        ? prisma.booking.groupBy({
            by: ["serviceId"],
            where: {
              createdAt: dateFilter,
              paymentStatus: PaymentStatus.SUCCESS,
              kind: BookingKind.SERVICE,
              serviceId: { not: null }
            },
            _count: { _all: true },
            _sum: { amount: true },
            orderBy: { _count: { serviceId: "desc" } }
          })
        : Promise.resolve([])
    ]);

    const roomIds = roomBreakdownRaw.map((r) => r.roomId).filter((id): id is string => Boolean(id));
    const serviceIds = serviceBreakdownRaw
      .map((s) => s.serviceId)
      .filter((id): id is string => Boolean(id));

    const [rooms, services, recentBookings, recentDeliveryOrders] = await Promise.all([
      roomIds.length
        ? prisma.room.findMany({
            where: { id: { in: roomIds } }
          })
        : Promise.resolve([]),
      serviceIds.length
        ? prisma.service.findMany({
            where: { id: { in: serviceIds } }
          })
        : Promise.resolve([]),
      prisma.booking.findMany({
        where: bookingWhere,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          },
          room: true,
          service: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 30
      }),
      prisma.deliveryOrder.findMany({
        where: deliveryWhere,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 30
      })
    ]);

    const roomMap = new Map(rooms.map((room) => [room.id, room]));
    const serviceMap = new Map(services.map((service) => [service.id, service]));

    const roomBreakdown = roomBreakdownRaw.map((row) => {
      const room = row.roomId ? roomMap.get(row.roomId) : null;
      return {
        roomId: row.roomId,
        title: room?.title ?? "Unknown room",
        count: row._count._all,
        revenue: row._sum.amount ?? 0
      };
    });

    const serviceBreakdown = serviceBreakdownRaw.map((row) => {
      const service = row.serviceId ? serviceMap.get(row.serviceId) : null;
      return {
        serviceId: row.serviceId,
        title: service?.title ?? "Unknown service",
        type: service?.type ?? ServiceType.RENT_SCOOTY,
        count: row._count._all,
        revenue: row._sum.amount ?? 0
      };
    });

    const mappedDeliveryOrders = recentDeliveryOrders.map((d) => ({
      id: d.id,
      userId: d.userId,
      kind: "DELIVERY" as any,
      amount: d.totalAmount,
      paymentProvider: d.paymentProvider,
      paymentReference: d.paymentReference,
      paymentStatus: d.paymentStatus,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      user: d.user,
      items: d.items
    }));

    const combinedBookings = [...recentBookings, ...mappedDeliveryOrders]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 30);

    return {
      summary: {
        totalBookings: totalBookings + totalDeliveryOrders,
        successfulBookings: successfulBookings + successfulDeliveryOrders,
        roomsPurchased: roomSuccessCount,
        servicesPurchased: serviceSuccessCount,
        deliveryOrders: successfulDeliveryOrders,
        totalRevenue: (revenue._sum.amount ?? 0) + (deliveryRevenue._sum.totalAmount ?? 0)
      },
      roomBreakdown,
      serviceBreakdown,
      recentBookings: combinedBookings
    };
  }
  async getPartnerPayouts() {
    const partners = await prisma.deliveryPartner.findMany({
      where: { payoutRequestedAt: { not: null } },
      select: {
        id: true,
        name: true,
        phone: true,
        upiId: true,
        payoutRequestedAt: true,
        orders: {
          where: {
            status: DeliveryOrderStatus.DELIVERED,
            isPayoutCleared: false
          },
          select: { partnerCut: true }
        }
      }
    });

    return {
      payouts: partners.map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        upiId: p.upiId,
        payoutRequestedAt: p.payoutRequestedAt,
        amount: p.orders.reduce((sum, o) => sum + o.partnerCut, 0)
      }))
    };
  }

  async clearPartnerPayout(partnerId: string, utrNumber: string) {
    const result = await prisma.$transaction(async (tx) => {
      const orders = await tx.deliveryOrder.updateMany({
        where: {
          partnerId,
          status: DeliveryOrderStatus.DELIVERED,
          isPayoutCleared: false
        },
        data: {
          isPayoutCleared: true,
          payoutReference: utrNumber
        }
      });

      const partner = await tx.deliveryPartner.update({
        where: { id: partnerId },
        data: { payoutRequestedAt: null }
      });

      return { ordersUpdated: orders.count, partner };
    });

    return { message: "Payout cleared successfully", ...result };
  }
}

export const adminService = new AdminService();
