import { BookingKind, ServiceType } from "@prisma/client";
import { z } from "zod";

const nullableUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.string().url().nullable().optional()
);

const imageUrlsSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      return value
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean);
    }

    if (Array.isArray(value)) {
      return value.filter((url): url is string => typeof url === "string").map((url) => url.trim()).filter(Boolean);
    }

    return value;
  },
  z.array(z.string().url()).max(12).optional()
);

const nullableStringSchema = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().min(min).max(max).nullable().optional()
  );

const nullableCoordinateSchema = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim().length === 0) {
        return null;
      }

      return value;
    },
    z.coerce.number().min(min).max(max).nullable().optional()
  );

const tagsSchema = z.preprocess(
  (value) => {
    const normalize = (tag: string) => tag.trim().replace(/\s+/g, " ");

    if (typeof value === "string") {
      return value
        .split(",")
        .map(normalize)
        .filter(Boolean);
    }

    if (Array.isArray(value)) {
      return value
        .filter((tag): tag is string => typeof tag === "string")
        .map(normalize)
        .filter(Boolean);
    }

    return value;
  },
  z.array(z.string().min(2).max(40)).max(12).optional()
);

const roomPhotosSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return [];
      }

      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [type, ...urlParts] = line.split("|").map((part) => part.trim());
            return { type, urls: urlParts.join("|").split(",").map((url) => url.trim()).filter(Boolean) };
          });
      }
    }

    return value;
  },
  z
    .array(
      z
        .object({
          url: z.string().trim().url().optional(),
          urls: z.array(z.string().trim().url()).max(24).optional(),
          type: z.string().trim().min(2).max(80)
        })
        .refine((photo) => Boolean(photo.url) || Boolean(photo.urls?.length), {
          message: "Each room photo area needs at least one image URL."
        })
    )
    .max(24)
    .optional()
);

const serviceDetailSectionsSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({ title: line, items: [] }));
      }
    }

    return value;
  },
  z
    .array(
      z.object({
        title: z.string().trim().min(2).max(80),
        body: z.string().trim().min(2).max(500).optional(),
        items: z.array(z.string().trim().min(2).max(180)).max(8).optional()
      })
    )
    .max(8)
    .optional()
);

const serviceActivityOptionsSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return [];
      }

      return JSON.parse(trimmed);
    }

    return value;
  },
  z
    .array(
      z.object({
        id: z.string().trim().min(2).max(80).optional(),
        title: z.string().trim().min(2).max(100),
        description: z.string().trim().min(2).max(300).optional(),
        pricePerGuest: z.coerce.number().int().min(0)
      })
    )
    .max(12)
    .optional()
);

export const roomPayloadSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(5).max(4000),
  price: z.coerce.number().int().positive(),
  imageUrl: nullableUrlSchema,
  imageUrls: imageUrlsSchema,
  roomPhotoTypes: tagsSchema,
  roomPhotos: roomPhotosSchema,
  address: nullableStringSchema(5, 300),
  ownerPhone: nullableStringSchema(8, 20),
  tags: tagsSchema,
  amenities: tagsSchema,
  unavailableAmenities: tagsSchema,
  sleepTitle: nullableStringSchema(2, 80),
  sleepDescription: nullableStringSchema(2, 120),
  latitude: nullableCoordinateSchema(-90, 90),
  longitude: nullableCoordinateSchema(-180, 180),
  googleMapUrl: nullableUrlSchema,
  capacity: z.coerce.number().int().positive().optional(),
  available: z.boolean().optional()
});

export const servicePayloadSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(5).max(4000),
  price: z.coerce.number().int().positive(),
  type: z.nativeEnum(ServiceType),
  imageUrl: nullableUrlSchema,
  imageUrls: imageUrlsSchema,
  detailSections: serviceDetailSectionsSchema,
  activityOptions: serviceActivityOptionsSchema,
  requiredDocuments: tagsSchema,
  pickupAddress: nullableStringSchema(5, 300),
  contactPhone: nullableStringSchema(8, 20),
  latitude: nullableCoordinateSchema(-90, 90),
  longitude: nullableCoordinateSchema(-180, 180),
  ctaLabel: nullableStringSchema(2, 40),
  googleMapUrl: nullableUrlSchema,
  available: z.boolean().optional()
});

export const createBookingIntentSchema = z.object({
  kind: z.nativeEnum(BookingKind),
  itemId: z.string().min(1),
  quantity: z.coerce.number().int().positive().optional(),
  activityOptions: serviceActivityOptionsSchema,
  bookedFor: z.string().datetime().optional(),
  checkInDate: z.string().datetime().optional(),
  checkOutDate: z.string().datetime().optional(),
  contactName: z.string().trim().min(1).max(120).optional(),
  contactPhone: z.string().trim().regex(/^\d{10}$/u, "contactPhone must be 10 digits").optional(),
  guests: z
    .array(z.object({ name: z.string().trim().min(1).max(120) }))
    .max(50)
    .optional()
});

export const confirmBookingPaymentSchema = z.object({
  bookingId: z.string().min(1),
  paymentReference: z.string().min(1).optional(),
  success: z.boolean(),
  razorpayPaymentId: z.string().optional(),
  razorpayOrderId: z.string().optional(),
  razorpaySignature: z.string().optional()
});

export const uploadImageSchema = z.object({
  imageBase64: z.string().min(20),
  fileName: z.string().min(1).max(120).optional(),
  folder: z.string().min(1).max(120).optional()
});

export const roomReviewPayloadSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(10).max(800)
});

export type RoomPayloadInput = z.infer<typeof roomPayloadSchema>;
export type ServicePayloadInput = z.infer<typeof servicePayloadSchema>;
export type CreateBookingIntentInput = z.infer<typeof createBookingIntentSchema>;
export type ConfirmBookingPaymentInput = z.infer<typeof confirmBookingPaymentSchema>;
export type UploadImageInput = z.infer<typeof uploadImageSchema>;
export type RoomReviewPayloadInput = z.infer<typeof roomReviewPayloadSchema>;
