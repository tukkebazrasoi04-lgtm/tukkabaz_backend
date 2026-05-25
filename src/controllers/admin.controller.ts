import { type NextFunction, type Request, type Response } from "express";
import { authService } from "../services/auth.service";
import { AppError } from "../middleware/error.middleware";
import { sendSuccess } from "../utils/api-response";
import { adminService } from "../services/admin.service";
import { uploadService } from "../services/upload.service";
import { adminLoginSchema } from "../validators/auth.validator";
import {
  roomPayloadSchema,
  servicePayloadSchema,
  uploadImageSchema
} from "../validators/catalog.validator";

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
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const response = await adminService.getAnalytics();
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
