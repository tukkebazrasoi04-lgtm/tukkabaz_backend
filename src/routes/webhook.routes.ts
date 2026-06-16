import { Router } from "express";
import { razorpayWebhookController } from "../controllers/webhook.controller";

const router = Router();

// Razorpay → server payment notifications. Authenticated by webhook signature,
// not by user auth, so no auth middleware here.
router.post("/razorpay", razorpayWebhookController);

export default router;
