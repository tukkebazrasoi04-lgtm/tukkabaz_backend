import { type NextFunction, type Request, type Response } from "express";
import { AppError } from "../middleware/error.middleware";
import { bookingService } from "../services/booking.service";
import { sendSuccess } from "../utils/api-response";
import {
  confirmBookingPaymentSchema,
  createBookingIntentSchema
} from "../validators/catalog.validator";

export const createBookingIntentController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const parsed = createBookingIntentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await bookingService.createBookingIntent(req.user.userId, parsed.data);
    sendSuccess(res, response, 201);
  } catch (error) {
    next(error);
  }
};

export const confirmBookingPaymentController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const parsed = confirmBookingPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await bookingService.confirmBookingPayment(req.user.userId, parsed.data);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const getMyBookingsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const response = await bookingService.getMyBookings(req.user.userId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};
