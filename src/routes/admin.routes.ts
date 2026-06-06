import { Router } from "express";
import {
  adminAnalyticsController,
  adminCreateRoomController,
  adminCreateServiceController,
  adminDeleteRoomController,
  adminDeleteServiceController,
  adminGetRoomsController,
  adminGetServicesController,
  adminLoginController,
  adminUploadImageController,
  adminUpdateRoomController,
  adminUpdateServiceController,
  adminGetPartnerPayoutsController,
  adminClearPartnerPayoutController,
  adminUpdatePushTokenController,
  adminUpdateDeliveryConfigController,
  adminGetRoomAvailabilityController,
  adminSetRoomAvailabilityController,
  adminClearRoomAvailabilityController,
  adminGetServiceAvailabilityController,
  adminSetServiceAvailabilityController,
  adminClearServiceAvailabilityController
} from "../controllers/admin.controller";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import { adminDeleteImageController, adminUploadMediaController } from "../controllers/media.controller";
import { ServiceType } from "@prisma/client";

const router = Router();

router.post("/login", adminLoginController);

router.use(authMiddleware, requireRoles("ADMIN"));
router.get("/services/types", (req, res, next) => {
  try {
    res.json({ success: true, data: Object.values(ServiceType) });
  } catch (err) {
    next(err);
  }
});
router.get("/analytics", adminAnalyticsController);
router.get("/rooms", adminGetRoomsController);
router.post("/rooms", adminCreateRoomController);
router.put("/rooms/:id", adminUpdateRoomController);
router.delete("/rooms/:id", adminDeleteRoomController);
router.get("/rooms/:id/availability", adminGetRoomAvailabilityController);
router.put("/rooms/:id/availability", adminSetRoomAvailabilityController);
router.delete("/rooms/:id/availability", adminClearRoomAvailabilityController);
router.post("/uploads/image", adminUploadImageController);
router.get("/services", adminGetServicesController);
router.post("/services", adminCreateServiceController);
router.put("/services/:id", adminUpdateServiceController);
router.delete("/services/:id", adminDeleteServiceController);
router.get("/services/:id/availability", adminGetServiceAvailabilityController);
router.put("/services/:id/availability", adminSetServiceAvailabilityController);
router.delete("/services/:id/availability", adminClearServiceAvailabilityController);
router.post("/media/upload", adminUploadMediaController);
router.delete("/media/:public_id(.*)", adminDeleteImageController);

router.get("/partner-payouts", adminGetPartnerPayoutsController);
router.post("/partner-payouts/:id/clear", adminClearPartnerPayoutController);
router.patch("/push-token", adminUpdatePushTokenController);
router.post("/delivery-config", adminUpdateDeliveryConfigController);

export default router;
