import { Router } from "express";
import {
  assignDeliveryPartnerController,
  acceptDeliveryOrderController,
  createKitchenDeliveryItemController,
  createDeliveryOrderController,
  createDeliveryPartnerController,
  getAvailableDeliveryPartnersController,
  getAvailableDeliveryOrdersForPartnerController,
  getDeliveryContactController,
  getDeliveryItemsController,
  getDeliveryOrderController,
  getDeliveryPartnerOrdersController,
  getKitchenDeliveryItemsController,
  getKitchenDeliveryOrdersController,
  getMyDeliveryOrdersController,
  markDeliveryDoneController,
  markDeliveryPickedUpController,
  requestKitchenOtpController,
  requestDeliveryPartnerOtpController,
  startDeliveryOrderController,
  updateDeliveryItemInventoryController,
  updateKitchenDeliveryItemController,
  updateDeliveryOrderStatusController,
  updateDeliveryPartnerAvailabilityController,
  updateDeliveryPartnerLocationController,
  verifyKitchenOtpController,
  verifyDeliveryPartnerOtpController,
  uploadPartnerDlController,
  getPendingPartnersController,
  getAllPartnersController,
  verifyPartnerController,
  getPartnerEarningsController,
  updatePartnerUpiController,
  requestPartnerPayoutController,
  loginDeliveryPartnerController,
  updatePartnerPushTokenController
} from "../controllers/delivery.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/items", getDeliveryItemsController);
router.get("/contact", getDeliveryContactController);

router.post("/orders", authMiddleware, createDeliveryOrderController);
router.get("/orders/available-for-partner", getAvailableDeliveryOrdersForPartnerController);
router.get("/orders/my", authMiddleware, getMyDeliveryOrdersController);
router.get("/orders/:id", authMiddleware, getDeliveryOrderController);
router.patch("/orders/:id/status", authMiddleware, updateDeliveryOrderStatusController);
router.patch("/orders/:id/assign-partner", authMiddleware, assignDeliveryPartnerController);
router.patch("/orders/:id/accept", acceptDeliveryOrderController);
router.patch("/orders/:id/picked-up", markDeliveryPickedUpController);
router.patch("/orders/:id/start-delivery", startDeliveryOrderController);
router.patch("/orders/:id/delivered", markDeliveryDoneController);

router.post("/partners", createDeliveryPartnerController);
router.post("/partners/login", loginDeliveryPartnerController);
router.post("/partners/request-otp", requestDeliveryPartnerOtpController);
router.post("/partners/verify-otp", verifyDeliveryPartnerOtpController);
router.get("/partners/available", authMiddleware, getAvailableDeliveryPartnersController);
router.get("/partners/:id/orders", getDeliveryPartnerOrdersController);
router.patch("/partners/:id/availability", authMiddleware, updateDeliveryPartnerAvailabilityController);
router.patch("/partners/:id/push-token", updatePartnerPushTokenController);
router.patch("/partners/:id/location", authMiddleware, updateDeliveryPartnerLocationController);
router.get("/partners/:id/earnings", getPartnerEarningsController);
router.patch("/partners/:id/upi", updatePartnerUpiController);
router.post("/partners/:id/request-payout", requestPartnerPayoutController);

router.get("/kitchen/orders", getKitchenDeliveryOrdersController);
router.post("/kitchen/request-otp", requestKitchenOtpController);
router.post("/kitchen/verify-otp", verifyKitchenOtpController);
router.patch("/kitchen/orders/:id/status", updateDeliveryOrderStatusController);
router.get("/kitchen/items", getKitchenDeliveryItemsController);
router.post("/kitchen/items", createKitchenDeliveryItemController);
router.put("/kitchen/items/:id", updateKitchenDeliveryItemController);
router.patch("/kitchen/items/:id", updateDeliveryItemInventoryController);

router.patch("/partners/:id/dl", uploadPartnerDlController);

// Admin-only partner verification routes (protected in admin.routes.ts)
router.get("/admin/partners", getAllPartnersController);
router.get("/admin/partners/pending", getPendingPartnersController);
router.patch("/admin/partners/:id/verify", verifyPartnerController);

export default router;
