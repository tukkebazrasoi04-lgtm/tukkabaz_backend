import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

const cloudinaryWidth = 1400;

const optimizeCloudinaryUrl = (url: string | null | undefined): string | null | undefined => {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }

  return url.replace(/\/upload\/(?:[^/]+\/)?(?=v\d+\/)/, `/upload/f_auto,q_auto,w_${cloudinaryWidth}/`);
};

const optimizeUrlArray = (urls: string[]): string[] => urls.map((url) => optimizeCloudinaryUrl(url) ?? url);

const optimizeRoomPhotos = (value: Prisma.JsonValue): Prisma.InputJsonValue => {
  if (!Array.isArray(value)) {
    return value as Prisma.InputJsonValue;
  }

  return value.map((photo) => {
    if (typeof photo !== "object" || photo === null || Array.isArray(photo)) {
      return photo;
    }

    const nextPhoto = { ...photo } as Record<string, unknown>;

    if (typeof nextPhoto.url === "string") {
      nextPhoto.url = optimizeCloudinaryUrl(nextPhoto.url);
    }

    if (Array.isArray(nextPhoto.urls)) {
      nextPhoto.urls = nextPhoto.urls.map((url) => (typeof url === "string" ? optimizeCloudinaryUrl(url) ?? url : url));
    }

    return nextPhoto;
  }) as Prisma.InputJsonValue;
};

const updateRooms = async (): Promise<number> => {
  const rooms = await prisma.room.findMany({
    select: {
      id: true,
      imageUrl: true,
      imageUrls: true,
      roomPhotos: true
    }
  });
  let updatedCount = 0;

  for (const room of rooms) {
    const nextImageUrl = optimizeCloudinaryUrl(room.imageUrl);
    const nextImageUrls = optimizeUrlArray(room.imageUrls);
    const nextRoomPhotos = optimizeRoomPhotos(room.roomPhotos);

    if (
      nextImageUrl === room.imageUrl &&
      JSON.stringify(nextImageUrls) === JSON.stringify(room.imageUrls) &&
      JSON.stringify(nextRoomPhotos) === JSON.stringify(room.roomPhotos)
    ) {
      continue;
    }

    await prisma.room.update({
      where: { id: room.id },
      data: {
        imageUrl: nextImageUrl,
        imageUrls: nextImageUrls,
        roomPhotos: nextRoomPhotos
      }
    });
    updatedCount += 1;
  }

  return updatedCount;
};

const updateServices = async (): Promise<number> => {
  const services = await prisma.service.findMany({
    select: {
      id: true,
      imageUrl: true,
      imageUrls: true
    }
  });
  let updatedCount = 0;

  for (const service of services) {
    const nextImageUrl = optimizeCloudinaryUrl(service.imageUrl);
    const nextImageUrls = optimizeUrlArray(service.imageUrls);

    if (nextImageUrl === service.imageUrl && JSON.stringify(nextImageUrls) === JSON.stringify(service.imageUrls)) {
      continue;
    }

    await prisma.service.update({
      where: { id: service.id },
      data: {
        imageUrl: nextImageUrl,
        imageUrls: nextImageUrls
      }
    });
    updatedCount += 1;
  }

  return updatedCount;
};

const updateDeliveryItems = async (): Promise<number> => {
  const items = await prisma.deliveryItem.findMany({
    select: {
      id: true,
      imageUrl: true
    }
  });
  let updatedCount = 0;

  for (const item of items) {
    const nextImageUrl = optimizeCloudinaryUrl(item.imageUrl);

    if (nextImageUrl === item.imageUrl) {
      continue;
    }

    await prisma.deliveryItem.update({
      where: { id: item.id },
      data: {
        imageUrl: nextImageUrl
      }
    });
    updatedCount += 1;
  }

  return updatedCount;
};

const main = async (): Promise<void> => {
  const [rooms, services, deliveryItems] = await Promise.all([
    updateRooms(),
    updateServices(),
    updateDeliveryItems()
  ]);

  logger.info("cloudinary-urls:optimized", {
    rooms,
    services,
    deliveryItems,
    width: cloudinaryWidth
  });
};

main()
  .catch((error) => {
    logger.error("cloudinary-urls:failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
