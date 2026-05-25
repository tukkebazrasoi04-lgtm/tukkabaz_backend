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
  adminUpdateServiceController
} from "../controllers/admin.controller";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", adminLoginController);

router.use(authMiddleware, requireRoles("ADMIN"));
router.get("/analytics", adminAnalyticsController);
router.get("/rooms", adminGetRoomsController);
router.post("/rooms", adminCreateRoomController);
router.put("/rooms/:id", adminUpdateRoomController);
router.delete("/rooms/:id", adminDeleteRoomController);
router.post("/uploads/image", adminUploadImageController);
router.get("/services", adminGetServicesController);
router.post("/services", adminCreateServiceController);
router.put("/services/:id", adminUpdateServiceController);
router.delete("/services/:id", adminDeleteServiceController);

export default router;
