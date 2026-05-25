import { type NextFunction, type Request, type Response } from "express";
import { AppError } from "../middleware/error.middleware";
import { deliveryService } from "../services/delivery.service";
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
} from "../validators/delivery.validator";

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

    const response = await deliveryService.createPartner(parsed.data);
    sendSuccess(res, response, 201);
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
    const response = await deliveryService.getAvailablePartners();
    sendSuccess(res, response);
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
