import { type NextFunction, type Request, type Response } from "express";
import crypto from "crypto";
import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";
import { deliveryService } from "../services/delivery.service";
import { bookingService } from "../services/booking.service";

type RazorpayWebhookBody = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    order?: { entity?: { id?: string } };
  };
};

/**
 * POST /webhooks/razorpay
 *
 * Server-side source of truth for payment success. Razorpay calls this even when
 * the customer's app never reached the confirm endpoint (network drop, app
 * killed mid-checkout), so an order/booking is never left stuck on PENDING after
 * the money is actually captured.
 */
export const razorpayWebhookController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new AppError(500, "Razorpay webhook secret is not configured on the server.");
    }

    const signature = req.header("x-razorpay-signature");
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!signature || !rawBody) {
      throw new AppError(400, "Missing webhook signature or body.");
    }

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    // Timing-safe compare; bail if lengths differ (would throw otherwise).
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
      throw new AppError(400, "Webhook signature verification failed.");
    }

    const body = req.body as RazorpayWebhookBody;
    const event = body.event;
    const paymentEntity = body.payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id ?? body.payload?.order?.entity?.id;
    const razorpayPaymentId = paymentEntity?.id;

    // Payment failed/cancelled server-side → mark the order failed and release the
    // reserved stock, even if the app never reported it (e.g. app was killed).
    if (event === "payment.failed" && razorpayOrderId) {
      const failedDelivery = await deliveryService.failViaRazorpayOrder(razorpayOrderId);
      if (!failedDelivery) {
        await bookingService.failViaRazorpayOrder(razorpayOrderId);
      }
      res.status(200).json({ received: true });
      return;
    }

    // Acknowledge non-payment events without doing anything.
    const isPaidEvent = event === "payment.captured" || event === "order.paid";
    if (!isPaidEvent || !razorpayOrderId || !razorpayPaymentId) {
      res.status(200).json({ received: true });
      return;
    }

    // The Razorpay order id was stored as paymentReference at checkout, so we can
    // route it to whichever entity owns it. Try delivery first, then bookings.
    const deliveryResult = await deliveryService.confirmPaidViaRazorpayOrder(razorpayOrderId, razorpayPaymentId);
    if (!deliveryResult) {
      await bookingService.confirmPaidViaRazorpayOrder(razorpayOrderId, razorpayPaymentId);
    }

    // Always 200 so Razorpay stops retrying once we've processed (or safely ignored) it.
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};
