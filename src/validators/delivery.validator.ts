import { DeliveryCategory, DeliveryOrderStatus, PaymentStatus } from "@prisma/client";
import { z } from "zod";

export const deliveryCategoryQuerySchema = z.object({
  category: z.nativeEnum(DeliveryCategory).optional()
});

export const createDeliveryOrderSchema = z.object({
  items: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.coerce.number().int().positive()
  })).min(1),
  deliveryAddress: z.string().min(5).max(500),
  customerPhone: z.string().min(7).max(20),
  destinationLat: z.coerce.number().optional(),
  destinationLng: z.coerce.number().optional(),
  paymentProvider: z.string().trim().min(2).max(40).optional(),
  paymentReference: z.string().trim().min(1).max(120).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional()
});

export const deliveryInventorySchema = z.object({
  availableQuantity: z.coerce.number().int().min(0),
  isAvailable: z.boolean().optional()
});

export const deliveryItemPayloadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(500),
  price: z.coerce.number().int().positive(),
  imageUrl: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().url().nullable().optional()
  ),
  category: z.nativeEnum(DeliveryCategory),
  grocerySection: z.string().trim().min(2).max(80).nullable().optional(),
  availableQuantity: z.coerce.number().int().min(0),
  isAvailable: z.boolean().optional()
});

export const deliveryStatusSchema = z.object({
  status: z.nativeEnum(DeliveryOrderStatus)
});

export const createDeliveryPartnerSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(7).max(20),
  vehicleType: z.string().min(2).max(80),
  currentLat: z.coerce.number().optional(),
  currentLng: z.coerce.number().optional()
});

export const partnerAvailabilitySchema = z.object({
  isAvailable: z.boolean()
});

export const assignPartnerSchema = z.object({
  partnerId: z.string().min(1)
});

export const partnerLocationSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number()
});

export const partnerOtpRequestSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(7).max(20),
  vehicleType: z.string().min(2).max(80).optional()
});

export const partnerOtpVerifySchema = z.object({
  phone: z.string().min(7).max(20),
  otp: z.string().min(4).max(8).optional()
});

export const kitchenOtpRequestSchema = z.object({
  phone: z.string().min(7).max(20)
});

export const kitchenOtpVerifySchema = z.object({
  phone: z.string().min(7).max(20),
  otp: z.string().min(4).max(8).optional()
});

export const partnerOrderActionSchema = z.object({
  partnerId: z.string().min(1)
});

export type CreateDeliveryOrderInput = z.infer<typeof createDeliveryOrderSchema>;
export type CreateDeliveryPartnerInput = z.infer<typeof createDeliveryPartnerSchema>;
export type DeliveryItemPayloadInput = z.infer<typeof deliveryItemPayloadSchema>;
