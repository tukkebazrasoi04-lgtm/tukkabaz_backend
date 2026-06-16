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
  servingInfo: z.string().trim().min(1).max(80).nullable().optional(),
  pieces: z.string().trim().min(1).max(80).nullable().optional(),
  availableQuantity: z.coerce.number().int().min(0),
  isAvailable: z.boolean().optional(),
  isVeg: z.boolean().optional()
});

export const deliveryStatusSchema = z.object({
  status: z.nativeEnum(DeliveryOrderStatus)
});

export const createDeliveryPartnerSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  password: z.string().min(6),
  currentLat: z.coerce.number().optional(),
  currentLng: z.coerce.number().optional()
});

export const partnerAvailabilitySchema = z.object({
  isAvailable: z.boolean().optional(),
  isOnline: z.boolean().optional()
}).refine(data => data.isAvailable !== undefined || data.isOnline !== undefined, {
  message: "Either isAvailable or isOnline must be provided"
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

export const kitchenLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const partnerOrderActionSchema = z.object({
  partnerId: z.string().min(1),
  otp: z.string().trim().min(1).max(8).optional()
});

export const dlUploadSchema = z.object({
  dlUrl: z.string().url("dlUrl must be a valid URL").optional(),
  imageBase64: z.string().optional(),
  profilePhotoUrl: z.string().url("profilePhotoUrl must be a valid URL").optional(),
  profileImageBase64: z.string().optional(),
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits").optional()
}).refine(data => data.dlUrl || data.imageBase64 || data.profilePhotoUrl || data.profileImageBase64 || data.phone, {
  message: "At least one detail (dlUrl, imageBase64, profilePhotoUrl, profileImageBase64, or phone) must be provided"
});

export const partnerVerifySchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(500).optional()
});

export const loginDeliveryPartnerSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  password: z.string()
});

export const updatePushTokenSchema = z.object({
  pushToken: z.string().min(1)
});

export const partnerPasswordResetRequestSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits")
});

export const partnerPasswordResetSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  otp: z.string().min(4).max(8),
  newPassword: z.string().min(6, "Password must be at least 6 characters")
});

export const confirmDeliveryPaymentSchema = z.object({
  orderId: z.string().min(1),
  success: z.boolean(),
  paymentReference: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpayOrderId: z.string().optional(),
  razorpaySignature: z.string().optional()
});

export type CreateDeliveryOrderInput = z.infer<typeof createDeliveryOrderSchema>;
export type CreateDeliveryPartnerInput = z.infer<typeof createDeliveryPartnerSchema>;
export type DeliveryItemPayloadInput = z.infer<typeof deliveryItemPayloadSchema>;
export type DlUploadInput = z.infer<typeof dlUploadSchema>;
export type PartnerVerifyInput = z.infer<typeof partnerVerifySchema>;
export type ConfirmDeliveryPaymentInput = z.infer<typeof confirmDeliveryPaymentSchema>;

export const updateDeliveryConfigSchema = z.object({
  baseDeliveryFee: z.coerce.number().int().min(0),
  deliveryFeePerKm: z.coerce.number().int().min(0),
  freeDeliveryThreshold: z.coerce.number().int().min(0),
  defaultRiderCut: z.coerce.number().int().min(0),
  kitchenLat: z.coerce.number().min(-90).max(90).optional(),
  kitchenLng: z.coerce.number().min(-180).max(180).optional(),
  serviceRadiusKm: z.coerce.number().positive().max(100).optional(),
  kitchenAddress: z.string().trim().max(500).optional()
});

export type UpdateDeliveryConfigInput = z.infer<typeof updateDeliveryConfigSchema>;

// Kitchen sets its own pickup location + serviceable radius from its dashboard.
export const updateKitchenLocationSchema = z.object({
  kitchenLat: z.coerce.number().min(-90).max(90),
  kitchenLng: z.coerce.number().min(-180).max(180),
  serviceRadiusKm: z.coerce.number().positive().max(100),
  kitchenAddress: z.string().trim().max(500).optional()
});

export type UpdateKitchenLocationInput = z.infer<typeof updateKitchenLocationSchema>;
