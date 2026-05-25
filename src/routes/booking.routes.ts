import { Router } from "express";
import {
  confirmBookingPaymentController,
  createBookingIntentController,
  getMyBookingsController
} from "../controllers/booking.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/intent", authMiddleware, createBookingIntentController);
router.post("/confirm", authMiddleware, confirmBookingPaymentController);
router.get("/my", authMiddleware, getMyBookingsController);

export default router;
