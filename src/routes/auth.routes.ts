import { Router } from "express";
import {
  firebaseAuthController,
  getMeController,
  loginController,
  logoutController,
  requestPasswordResetController,
  requestPhoneVerificationController,
  requestUserOtpController,
  registerController,
  refreshTokenController,
  resetPasswordController,
  savePhoneController,
  verifyPhoneVerificationController,
  verifyUserOtpController
} from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/firebase", firebaseAuthController);
router.post("/register", registerController);
router.post("/login", loginController);
router.post("/password/forgot", requestPasswordResetController);
router.post("/password/reset", resetPasswordController);
router.post("/otp/request", requestUserOtpController);
router.post("/otp/verify", verifyUserOtpController);
router.post("/phone/request", authMiddleware, requestPhoneVerificationController);
router.post("/phone/verify", authMiddleware, verifyPhoneVerificationController);
router.post("/phone/save", authMiddleware, savePhoneController);
router.post("/refresh", refreshTokenController);
router.get("/me", authMiddleware, getMeController);
router.post("/logout", authMiddleware, logoutController);

export default router;
