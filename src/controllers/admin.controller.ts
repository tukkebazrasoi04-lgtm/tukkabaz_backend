import { type NextFunction, type Request, type Response } from "express";
import { authService } from "../services/auth.service";
import { AppError } from "../middleware/error.middleware";
import { sendSuccess } from "../utils/api-response";
import { adminService } from "../services/admin.service";
import { uploadService } from "../services/upload.service";
import { adminLoginSchema } from "../validators/auth.validator";
import {
  availabilityOverrideSchema,
  roomPayloadSchema,
  servicePayloadSchema,
  uploadImageSchema
} from "../validators/catalog.validator";
import { updateDeliveryConfigSchema } from "../validators/delivery.validator";

export const adminLoginController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await authService.loginAdminWithPassword(parsed.data.email, parsed.data.password, {
      userAgent: req.get("user-agent") || undefined,
      ipAddress: req.ip
    });

    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminCreateRoomController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = roomPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await adminService.createRoom(parsed.data);
    sendSuccess(res, response, 201);
  } catch (error) {
    next(error);
  }
};

export const adminGetRoomsController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const response = await adminService.getRooms();
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminUpdateRoomController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roomId = req.params.id;
    if (!roomId) {
      throw new AppError(400, "Room id is required");
    }

    const parsed = roomPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await adminService.updateRoom(roomId, parsed.data);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminDeleteRoomController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roomId = req.params.id;
    if (!roomId) {
      throw new AppError(400, "Room id is required");
    }

    const response = await adminService.deleteRoom(roomId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminCreateServiceController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = servicePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await adminService.createService(parsed.data);
    sendSuccess(res, response, 201);
  } catch (error) {
    next(error);
  }
};

export const adminGetServicesController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const response = await adminService.getServices();
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminUpdateServiceController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const serviceId = req.params.id;
    if (!serviceId) {
      throw new AppError(400, "Service id is required");
    }

    const parsed = servicePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await adminService.updateService(serviceId, parsed.data);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminDeleteServiceController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const serviceId = req.params.id;
    if (!serviceId) {
      throw new AppError(400, "Service id is required");
    }

    const response = await adminService.deleteService(serviceId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminAnalyticsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const period = req.query.period as string | undefined;
    const status = req.query.status as string | undefined;
    const response = await adminService.getAnalytics({ period, status });
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminUploadImageController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = uploadImageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await uploadService.uploadImage(parsed.data);
    sendSuccess(res, {
      message: "Image uploaded",
      ...response
    }, 201);
  } catch (error) {
    next(error);
  }
};

export const adminGetPartnerPayoutsController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const response = await adminService.getPartnerPayouts();
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminClearPartnerPayoutController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const partnerId = req.params.id;
    if (!partnerId) {
      throw new AppError(400, "Partner id is required");
    }

    const { utrNumber } = req.body;
    if (!utrNumber || typeof utrNumber !== "string") {
      throw new AppError(400, "Valid utrNumber is required");
    }

    const response = await adminService.clearPartnerPayout(partnerId, utrNumber);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminUpdatePushTokenController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { pushToken } = req.body;
    if (!pushToken || typeof pushToken !== "string") {
      throw new AppError(400, "Valid pushToken is required");
    }

    const { prisma } = await import("../lib/prisma");
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { pushToken }
    });

    sendSuccess(res, { message: "Push token updated" });
  } catch (error) {
    next(error);
  }
};

export const adminGetRoomAvailabilityController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roomId = req.params.id;
    if (!roomId) {
      throw new AppError(400, "Room id is required");
    }
    const response = await adminService.getRoomAvailabilityCalendar(
      roomId,
      req.query.from as string | undefined,
      req.query.to as string | undefined
    );
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminSetRoomAvailabilityController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roomId = req.params.id;
    if (!roomId) {
      throw new AppError(400, "Room id is required");
    }
    const parsed = availabilityOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }
    const response = await adminService.setRoomAvailabilityOverride(
      roomId,
      parsed.data.date,
      parsed.data.units,
      parsed.data.note
    );
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminClearRoomAvailabilityController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roomId = req.params.id;
    const date = req.query.date as string | undefined;
    if (!roomId || !date) {
      throw new AppError(400, "Room id and date are required");
    }
    const response = await adminService.clearRoomAvailabilityOverride(roomId, date);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminGetServiceAvailabilityController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const serviceId = req.params.id;
    if (!serviceId) {
      throw new AppError(400, "Service id is required");
    }
    const response = await adminService.getServiceAvailabilityCalendar(
      serviceId,
      req.query.from as string | undefined,
      req.query.to as string | undefined
    );
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminSetServiceAvailabilityController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const serviceId = req.params.id;
    if (!serviceId) {
      throw new AppError(400, "Service id is required");
    }
    const parsed = availabilityOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }
    const response = await adminService.setServiceAvailabilityOverride(
      serviceId,
      parsed.data.date,
      parsed.data.units,
      parsed.data.note
    );
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminClearServiceAvailabilityController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const serviceId = req.params.id;
    const date = req.query.date as string | undefined;
    if (!serviceId || !date) {
      throw new AppError(400, "Service id and date are required");
    }
    const response = await adminService.clearServiceAvailabilityOverride(serviceId, date);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const adminUpdateDeliveryConfigController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = updateDeliveryConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid delivery config body", parsed.error.flatten());
    }

    const response = await adminService.updateDeliveryConfig(parsed.data);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};
