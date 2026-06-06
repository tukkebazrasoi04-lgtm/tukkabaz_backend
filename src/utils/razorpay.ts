import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";

export type RazorpayOrder = {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: any[];
  created_at: number;
};

export async function createRazorpayOrder(amountInRupees: number, receiptId: string): Promise<RazorpayOrder> {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = env;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new AppError(500, "Razorpay credentials are not configured on the server.");
  }

  // Razorpay expects amount in paise (1 INR = 100 paise)
  const amountInPaise = Math.round(amountInRupees * 100);

  const authHeader = "Basic " + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: "INR",
      receipt: receiptId,
      // Auto-capture the payment as soon as it is authorized so funds are
      // actually collected (otherwise an authorized-only payment is auto-refunded
      // by Razorpay after a few days).
      payment_capture: 1
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Razorpay order creation failed:", errText);
    throw new AppError(response.status, `Razorpay API Error: ${errText}`);
  }

  return response.json() as Promise<RazorpayOrder>;
}
