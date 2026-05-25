import { type NextFunction, type Request, type Response } from "express";
import { catalogService } from "../services/catalog.service";
import { sendSuccess } from "../utils/api-response";
import { AppError } from "../middleware/error.middleware";
import { roomReviewPayloadSchema } from "../validators/catalog.validator";

export const getRoomsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const includeUnavailable = req.query.includeUnavailable === "true";
    const rooms = await catalogService.getRooms(includeUnavailable);
    sendSuccess(res, { rooms });
  } catch (error) {
    next(error);
  }
};

export const getServicesController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const includeUnavailable = req.query.includeUnavailable === "true";
    const services = await catalogService.getServices(includeUnavailable);
    sendSuccess(res, { services });
  } catch (error) {
    next(error);
  }
};

export const getRoomByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roomId = req.params.id;
    if (!roomId) {
      throw new AppError(400, "Room id is required");
    }

    const response = await catalogService.getRoomById(roomId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const getRoomReviewsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roomId = req.params.id;
    if (!roomId) {
      throw new AppError(400, "Room id is required");
    }

    const response = await catalogService.getRoomReviews(roomId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const getRoomReviewEligibilityController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const roomId = req.params.id;
    if (!roomId) {
      throw new AppError(400, "Room id is required");
    }

    const response = await catalogService.getReviewEligibility(req.user.userId, roomId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const upsertRoomReviewController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const roomId = req.params.id;
    if (!roomId) {
      throw new AppError(400, "Room id is required");
    }

    const parsed = roomReviewPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await catalogService.createOrUpdateRoomReview(
      req.user.userId,
      roomId,
      parsed.data
    );
    sendSuccess(res, response, 201);
  } catch (error) {
    next(error);
  }
};
