import { type NextFunction, type Request, type Response } from "express";
import { AppError } from "../middleware/error.middleware";
import { deliveryService } from "../services/delivery.service";
import { uploadService } from "../services/upload.service";
import { sendSuccess } from "../utils/api-response";
import {
  assignPartnerSchema,
  createDeliveryOrderSchema,
  createDeliveryPartnerSchema,
  deliveryCategoryQuerySchema,
  deliveryInventorySchema,
  deliveryItemPayloadSchema,
  deliveryStatusSchema,
  kitchenOtpRequestSchema,
  kitchenOtpVerifySchema,
  partnerOrderActionSchema,
  partnerAvailabilitySchema,
  partnerLocationSchema,
  partnerOtpRequestSchema,
  partnerOtpVerifySchema,
  dlUploadSchema,
  partnerVerifySchema,
  loginDeliveryPartnerSchema,
  updatePushTokenSchema,
} from "../validators/delivery.validator";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";

export const getDeliveryItemsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = deliveryCategoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, "Invalid delivery item query", parsed.error.flatten());
    }

    const response = await deliveryService.getItems(parsed.data.category);
    sendSuccess(res, { items: response });
  } catch (error) {
    next(error);
  }
};

export const getDeliveryContactController = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const response = await deliveryService.getContact();
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const createDeliveryOrderController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const parsed = createDeliveryOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid delivery order body", parsed.error.flatten());
    }

    const response = await deliveryService.createOrder(req.user.userId, parsed.data);
    sendSuccess(res, response, 201);
  } catch (error) {
    next(error);
  }
};

export const getMyDeliveryOrdersController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const response = await deliveryService.getMyOrders(req.user.userId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const getDeliveryOrderController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const orderId = req.params.id;
    if (!orderId) {
      throw new AppError(400, "Delivery order id is required");
    }

    const response = await deliveryService.getOrder(req.user.userId, orderId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryOrderStatusController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = req.params.id;
    if (!orderId) {
      throw new AppError(400, "Delivery order id is required");
    }

    const parsed = deliveryStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid delivery status body", parsed.error.flatten());
    }

    const response = await deliveryService.updateOrderStatus(orderId, parsed.data.status, req.user?.role);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const createDeliveryPartnerController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createDeliveryPartnerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid delivery partner body", parsed.error.flatten());
    }

    const { name, phone, password, currentLat, currentLng } = parsed.data;

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const partner = await prisma.deliveryPartner.create({
        data: {
          name: name.trim(),
          phone: phone.trim(),
          password: hashedPassword,
          vehicleType: "Bike / Scooty",
          currentLat,
          currentLng
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...partnerWithoutPassword } = partner;
      sendSuccess(res, { message: "Delivery partner created", partner: partnerWithoutPassword }, 201);
    } catch (dbError: any) {
      if (dbError.code === 'P2002' && dbError.meta?.target?.includes('phone')) {
        throw new AppError(409, "Phone number is already registered");
      }
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
};

export const loginDeliveryPartnerController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginDeliveryPartnerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid login body", parsed.error.flatten());
    }

    const { phone, password } = parsed.data;

    const partner = await prisma.deliveryPartner.findUnique({
      where: { phone: phone.trim() }
    });

    if (!partner || !partner.password) {
      throw new AppError(401, "Invalid phone or password");
    }

    const isMatch = await bcrypt.compare(password, partner.password);
    if (!isMatch) {
      throw new AppError(401, "Invalid phone or password");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...partnerWithoutPassword } = partner;
    sendSuccess(res, { message: "Login successful", partner: partnerWithoutPassword });
  } catch (error) {
    next(error);
  }
};

export const requestDeliveryPartnerOtpController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = partnerOtpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid partner OTP request body", parsed.error.flatten());
    }

    const response = await deliveryService.requestPartnerOtp(parsed.data);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const verifyDeliveryPartnerOtpController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = partnerOtpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid partner OTP body", parsed.error.flatten());
    }

    const response = await deliveryService.verifyPartnerOtp(parsed.data.phone, parsed.data.otp);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const requestKitchenOtpController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = kitchenOtpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid kitchen OTP request body", parsed.error.flatten());
    }

    const response = await deliveryService.requestKitchenOtp(parsed.data.phone);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const verifyKitchenOtpController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = kitchenOtpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid kitchen OTP body", parsed.error.flatten());
    }

    const response = await deliveryService.verifyKitchenOtp(parsed.data.phone, parsed.data.otp);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const getAvailableDeliveryPartnersController = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partners = await prisma.deliveryPartner.findMany({
      where: {
        isAvailable: true,
        profileStatus: 'APPROVED'
      },
      orderBy: { createdAt: 'desc' }
    });
    sendSuccess(res, { partners });
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryPartnerAvailabilityController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.params.id;
    if (!partnerId) {
      throw new AppError(400, "Delivery partner id is required");
    }

    const parsed = partnerAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid partner availability body", parsed.error.flatten());
    }

    const response = await deliveryService.updatePartnerAvailability(partnerId, parsed.data.isAvailable);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const getAvailableDeliveryOrdersForPartnerController = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const response = await deliveryService.getOpenOrdersForPartner();
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const getDeliveryPartnerOrdersController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.params.id;
    if (!partnerId) {
      throw new AppError(400, "Delivery partner id is required");
    }

    const response = await deliveryService.getPartnerOrders(partnerId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const assignDeliveryPartnerController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = req.params.id;
    if (!orderId) {
      throw new AppError(400, "Delivery order id is required");
    }

    const parsed = assignPartnerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid assign partner body", parsed.error.flatten());
    }

    const response = await deliveryService.assignPartner(orderId, parsed.data.partnerId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const acceptDeliveryOrderController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = req.params.id;
    if (!orderId) {
      throw new AppError(400, "Delivery order id is required");
    }

    const parsed = partnerOrderActionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid accept order body", parsed.error.flatten());
    }

    const response = await deliveryService.acceptOrder(orderId, parsed.data.partnerId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const markDeliveryPickedUpController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = req.params.id;
    if (!orderId) {
      throw new AppError(400, "Delivery order id is required");
    }

    const parsed = partnerOrderActionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid pickup body", parsed.error.flatten());
    }

    const response = await deliveryService.markPickedUp(orderId, parsed.data.partnerId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const startDeliveryOrderController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = req.params.id;
    if (!orderId) {
      throw new AppError(400, "Delivery order id is required");
    }

    const parsed = partnerOrderActionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid start delivery body", parsed.error.flatten());
    }

    const response = await deliveryService.startDelivery(orderId, parsed.data.partnerId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const markDeliveryDoneController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = req.params.id;
    if (!orderId) {
      throw new AppError(400, "Delivery order id is required");
    }

    const parsed = partnerOrderActionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid delivery body", parsed.error.flatten());
    }

    const response = await deliveryService.markDelivered(orderId, parsed.data.partnerId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryPartnerLocationController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.params.id;
    if (!partnerId) {
      throw new AppError(400, "Delivery partner id is required");
    }

    const parsed = partnerLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid partner location body", parsed.error.flatten());
    }

    const response = await deliveryService.updatePartnerLocation(partnerId, parsed.data.lat, parsed.data.lng);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const getKitchenDeliveryOrdersController = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const response = await deliveryService.getKitchenOrders();
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const getKitchenDeliveryItemsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = deliveryCategoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, "Invalid delivery item query", parsed.error.flatten());
    }

    const response = await deliveryService.getKitchenItems(parsed.data.category);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryItemInventoryController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const itemId = req.params.id;
    if (!itemId) {
      throw new AppError(400, "Delivery item id is required");
    }

    const parsed = deliveryInventorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid delivery inventory body", parsed.error.flatten());
    }

    const response = await deliveryService.updateItemInventory(itemId, parsed.data);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const createKitchenDeliveryItemController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = deliveryItemPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid delivery item body", parsed.error.flatten());
    }

    const response = await deliveryService.createKitchenItem(parsed.data);
    sendSuccess(res, response, 201);
  } catch (error) {
    next(error);
  }
};

export const updateKitchenDeliveryItemController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const itemId = req.params.id;
    if (!itemId) {
      throw new AppError(400, "Delivery item id is required");
    }

    const parsed = deliveryItemPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid delivery item body", parsed.error.flatten());
    }

    const response = await deliveryService.updateKitchenItem(itemId, parsed.data);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

// ─── DL Verification Controllers ──────────────────────────────────────────────

/** PATCH /delivery/partners/:id/dl
 *  Partner submits their DL image URL. Status moves to PENDING. */
export const uploadPartnerDlController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.params.id;
    if (!partnerId) {
      throw new AppError(400, "Partner id is required");
    }

    const parsed = dlUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid DL upload body", parsed.error.flatten());
    }

    let finalDlUrl = parsed.data.dlUrl;

    if (parsed.data.imageBase64) {
      const uploadRes = await uploadService.uploadImage({
        imageBase64: parsed.data.imageBase64,
        folder: "tukkabaz/partner_dl"
      });
      finalDlUrl = uploadRes.url;
    }

    const dataToUpdate: any = {};
    if (finalDlUrl) {
      dataToUpdate.dlUrl = finalDlUrl;
      dataToUpdate.profileStatus = "PENDING";
    }
    if (parsed.data.profilePhotoUrl) {
      dataToUpdate.profilePhotoUrl = parsed.data.profilePhotoUrl;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      throw new AppError(400, "No valid data provided to update.");
    }

    const partner = await prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: dataToUpdate
    });

    sendSuccess(res, { message: "Partner profile updated successfully.", partner });
  } catch (error) {
    next(error);
  }
};

/** GET /delivery/admin/partners/pending
 *  Admin: list all partners awaiting DL verification. */
export const getPendingPartnersController = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const response = await deliveryService.getPendingPartners();
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

/** GET /delivery/admin/partners
 *  Admin: fetch all partners. */
export const getAllPartnersController = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const response = await deliveryService.getAllPartners();
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

/** PATCH /delivery/admin/partners/:id/verify
 *  Admin: approve or reject a partner's DL. */
export const verifyPartnerController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.params.id;
    if (!partnerId) {
      throw new AppError(400, "Partner id is required");
    }

    const parsed = partnerVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid verify body — status must be APPROVED or REJECTED", parsed.error.flatten());
    }

    const response = await deliveryService.verifyPartner(partnerId, parsed.data.status);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

// ─── Payout & Earnings Controllers ────────────────────────────────────────────

export const getPartnerEarningsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.params.id;
    if (!partnerId) {
      throw new AppError(400, "Partner id is required");
    }

    const response = await deliveryService.getPartnerEarnings(partnerId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const updatePartnerUpiController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.params.id;
    if (!partnerId) {
      throw new AppError(400, "Partner id is required");
    }
    const upiId = req.body.upiId;
    if (!upiId || typeof upiId !== "string") {
      throw new AppError(400, "Valid upiId is required");
    }

    const response = await deliveryService.updatePartnerUpi(partnerId, upiId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const requestPartnerPayoutController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.params.id;
    if (!partnerId) {
      throw new AppError(400, "Partner id is required");
    }

    const response = await deliveryService.requestPartnerPayout(partnerId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const updatePartnerPushTokenController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.params.id;
    if (!partnerId) {
      throw new AppError(400, "Partner id is required");
    }

    const parsed = updatePushTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid push token body", parsed.error.flatten());
    }

    const partner = await prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: { pushToken: parsed.data.pushToken }
    });

    sendSuccess(res, { message: "Push token updated", partner });
  } catch (error) {
    next(error);
  }
};
