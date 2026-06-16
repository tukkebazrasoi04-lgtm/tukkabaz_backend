import { BookingKind, PaymentStatus, type Prisma } from "@prisma/client";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { notifyAdminNewBooking } from "../utils/notify-admin";
import { env } from "../config/env";
import { createRazorpayOrder } from "../utils/razorpay";
import { availabilityService } from "./availability.service";

async function generatePaymentReference(amount: number, receiptId: string): Promise<string> {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = env;
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    // Keys are configured (production/live): a real Razorpay order is required so
    // that payment signatures can be verified on confirmation. If order creation
    // fails we must NOT fall back to an unverified simulated reference — that
    // would let a payment be marked successful without verification.
    const order = await createRazorpayOrder(amount, receiptId);
    return order.id;
  }
  // No keys configured (local/dev only): simulated reference, no verification.
  return `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

type CreateBookingIntentInput = {
  kind: BookingKind;
  itemId: string;
  quantity?: number;
  activityOptions?: Array<{
    id?: string;
    title: string;
    description?: string;
    pricePerGuest: number;
  }>;
  bookedFor?: string;
  checkInDate?: string;
  checkOutDate?: string;
  contactName?: string;
  contactPhone?: string;
  guests?: Array<{ name: string }>;
};

type ConfirmBookingPaymentInput = {
  bookingId: string;
  paymentReference?: string;
  success: boolean;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
};

class BookingService {
  async createBookingIntent(userId: string, input: CreateBookingIntentInput) {
    const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;
    const contactName = input.contactName?.trim() || null;
    const contactPhone = input.contactPhone?.trim() || null;
    const guests = Array.isArray(input.guests)
      ? input.guests
          .map((guest) => ({ name: String(guest?.name ?? "").trim() }))
          .filter((guest) => guest.name.length > 0)
      : [];
    const checkInDate = input.checkInDate ?? input.bookedFor;
    const bookedForDate = checkInDate ? new Date(checkInDate) : null;
    const checkOutDate = input.checkOutDate ? new Date(input.checkOutDate) : null;

    if (bookedForDate && Number.isNaN(bookedForDate.getTime())) {
      throw new AppError(400, "checkInDate must be a valid ISO date");
    }

    if (checkOutDate && Number.isNaN(checkOutDate.getTime())) {
      throw new AppError(400, "checkOutDate must be a valid ISO date");
    }

    if (input.kind === BookingKind.ROOM) {
      if (!bookedForDate || !checkOutDate) {
        throw new AppError(400, "Room bookings require checkInDate and checkOutDate");
      }

      if (checkOutDate.getTime() <= bookedForDate.getTime()) {
        throw new AppError(400, "checkOutDate must be after checkInDate");
      }

      const room = await prisma.room.findUnique({
        where: { id: input.itemId }
      });

      if (!room || !room.available) {
        throw new AppError(404, "Room not found or unavailable");
      }

      // Reject up-front if any selected night is sold out.
      await availabilityService.assertRoomAvailable(room.id, bookedForDate, checkOutDate);

      const amount = room.price * quantity;
      const bookingReceiptId = `rec_room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const paymentReference = await generatePaymentReference(amount, bookingReceiptId);

      const booking = await prisma.booking.create({
        data: {
          userId,
          roomId: room.id,
          kind: BookingKind.ROOM,
          quantity,
          amount,
          paymentReference,
          paymentStatus: PaymentStatus.PENDING,
          bookedFor: bookedForDate,
          checkInDate: bookedForDate,
          checkOutDate,
          contactName,
          contactPhone,
          guests
        } as Prisma.BookingUncheckedCreateInput
      });

      return {
        message: "Payment intent created",
        bookingId: booking.id,
        amount,
        currency: "INR",
        paymentReference
      };
    }

    const service = await prisma.service.findUnique({
      where: { id: input.itemId }
    });

    if (!service || !service.available) {
      throw new AppError(404, "Service not found or unavailable");
    }

    // Date-scheduled services check per-date capacity. Contact-only services
    // booked without a date skip the inventory guard.
    if (bookedForDate) {
      await availabilityService.assertServiceAvailable(service.id, bookedForDate, quantity);
    }

    const selectedActivityOptions = (input.activityOptions ?? []).map((option) => ({
      id: option.id,
      title: option.title,
      description: option.description,
      pricePerGuest: Number.isFinite(option.pricePerGuest) ? Math.max(Math.floor(option.pricePerGuest), 0) : 0
    }));
    const addOnTotal = selectedActivityOptions.reduce((sum, option) => sum + option.pricePerGuest * quantity, 0);
    const amount = service.price * quantity + addOnTotal;
    const bookingReceiptId = `rec_svc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const paymentReference = await generatePaymentReference(amount, bookingReceiptId);

    const booking = await prisma.booking.create({
      data: {
        userId,
        serviceId: service.id,
        kind: BookingKind.SERVICE,
        quantity,
        amount,
        paymentReference,
        paymentStatus: PaymentStatus.PENDING,
        activityOptions: selectedActivityOptions,
        bookedFor: bookedForDate,
        checkInDate: bookedForDate,
        checkOutDate,
        contactName,
        contactPhone,
        guests
      } as Prisma.BookingUncheckedCreateInput
    });

    return {
      message: "Payment intent created",
      bookingId: booking.id,
      amount,
      currency: "INR",
      paymentReference
    };
  }

  // Webhook-driven confirmation: Razorpay reports a captured payment even if the
  // customer's app never reached the confirm call. Signature is already verified
  // by the webhook handler, so this confirmation is trusted.
  async confirmPaidViaRazorpayOrder(razorpayOrderId: string, razorpayPaymentId: string) {
    const booking = await prisma.booking.findFirst({ where: { paymentReference: razorpayOrderId } });
    if (!booking) {
      return null; // not a booking (could be a delivery order)
    }
    if (booking.paymentStatus === PaymentStatus.SUCCESS) {
      return booking;
    }
    return this.confirmBookingPayment(
      booking.userId,
      {
        bookingId: booking.id,
        success: true,
        razorpayPaymentId,
        razorpayOrderId
      },
      true
    );
  }

  async confirmBookingPayment(userId: string, input: ConfirmBookingPaymentInput, trusted = false) {
    const booking = await prisma.booking.findFirst({
      where: {
        id: input.bookingId,
        userId
      }
    });

    if (!booking) {
      throw new AppError(404, "Booking not found");
    }

    if (booking.paymentStatus === PaymentStatus.SUCCESS) {
      return {
        message: "Booking already confirmed",
        booking
      };
    }

    if (!trusted && input.success && booking.paymentReference?.startsWith("order_")) {
      const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = input;
      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        throw new AppError(400, "Missing Razorpay verification credentials.");
      }

      const { RAZORPAY_KEY_SECRET } = env;
      if (!RAZORPAY_KEY_SECRET) {
        throw new AppError(500, "Razorpay secret key is not configured on the server.");
      }

      if (booking.paymentReference !== razorpayOrderId) {
        throw new AppError(400, "Order ID mismatch.");
      }

      const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(razorpayOrderId + "|" + razorpayPaymentId)
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        throw new AppError(400, "Payment verification failed - signature mismatch.");
      }
    }

    const include = { room: true, service: true, user: true } as const;
    const nextPaymentReference = input.razorpayPaymentId ?? input.paymentReference ?? booking.paymentReference;

    let updated;
    if (input.success) {
      // Re-validate availability atomically so two payments can't oversell the
      // last unit. Exclude this booking's own held PENDING row from the count.
      try {
        updated = await prisma.$transaction(
          async (tx) => {
            if (booking.kind === BookingKind.ROOM && booking.roomId && booking.checkInDate && booking.checkOutDate) {
              await availabilityService.assertRoomAvailable(
                booking.roomId,
                booking.checkInDate,
                booking.checkOutDate,
                tx,
                booking.id
              );
            } else if (booking.kind === BookingKind.SERVICE && booking.serviceId && booking.bookedFor) {
              await availabilityService.assertServiceAvailable(
                booking.serviceId,
                booking.bookedFor,
                booking.quantity ?? 1,
                tx,
                booking.id
              );
            }

            return tx.booking.update({
              where: { id: booking.id },
              data: { paymentStatus: PaymentStatus.SUCCESS, paymentReference: nextPaymentReference },
              include
            });
          },
          { isolationLevel: "Serializable" }
        );
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 409) {
          // Sold out during the payment window — void the booking to release the hold.
          await prisma.booking
            .update({ where: { id: booking.id }, data: { paymentStatus: PaymentStatus.FAILED } })
            .catch(() => undefined);
        }
        throw error;
      }
    } else {
      updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: PaymentStatus.FAILED, paymentReference: nextPaymentReference },
        include
      });
    }

    if (input.success) {
      notifyAdminNewBooking({
        userName: updated.user.name ?? 'Guest',
        itemTitle: updated.kind === 'ROOM' && updated.room ? updated.room.title : updated.service ? updated.service.title : 'Unknown',
        kind: updated.kind,
        amount: updated.amount,
        reference: updated.paymentReference,
        checkIn: updated.checkInDate ? updated.checkInDate.toISOString().split('T')[0] : null,
        checkOut: updated.checkOutDate ? updated.checkOutDate.toISOString().split('T')[0] : null,
        contactName: updated.contactName,
        contactPhone: updated.contactPhone,
        guests: Array.isArray(updated.guests) ? (updated.guests as Array<{ name: string }>) : []
      });
    }

    return {
      message: input.success
        ? "Payment successful and booking registered"
        : "Payment failed, booking not confirmed",
      booking: updated
    };
  }

  async getMyBookings(userId: string) {
    const bookings = await prisma.booking.findMany({
      where: { userId },
      include: {
        room: true,
        service: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return { bookings };
  }
}

export const bookingService = new BookingService();
