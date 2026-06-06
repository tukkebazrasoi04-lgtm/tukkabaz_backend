import { Router } from "express";
import {
  getRoomByIdController,
  getRoomAvailabilityController,
  getServiceAvailabilityController,
  getRoomReviewEligibilityController,
  getRoomReviewsController,
  getRoomsController,
  getServicesController,
  upsertRoomReviewController
} from "../controllers/catalog.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/rooms", getRoomsController);
router.get("/rooms/:id", getRoomByIdController);
router.get("/rooms/:id/availability", getRoomAvailabilityController);
router.get("/services/:id/availability", getServiceAvailabilityController);
router.get("/rooms/:id/reviews", getRoomReviewsController);
router.get("/rooms/:id/review-eligibility", authMiddleware, getRoomReviewEligibilityController);
router.post("/rooms/:id/reviews", authMiddleware, upsertRoomReviewController);
router.get("/services", getServicesController);

export default router;
