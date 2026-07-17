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
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new AppError(500, "Razorpay keys are not configured. Cannot create payment order.");
  }
  const order = await createRazorpayOrder(amount, receiptId);
  return order.id;
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
      await availabilityService.assertRoomAvailable(room.id, bookedForDate, checkOutDate);

      const bookingTotal = room.price * quantity;
      const receiptId = `rec_room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const razorpayOrderId = await generatePaymentReference(bookingTotal, receiptId);

      const booking = await prisma.booking.create({
        data: {
          userId,
          kind: input.kind,
          roomId: room.id,
          quantity,
          amount: bookingTotal,
          paymentProvider: "RAZORPAY",
          razorpayOrderId: razorpayOrderId,
          paymentStatus: PaymentStatus.PENDING,
          bookedFor: checkInDate,
          checkInDate,
          checkOutDate,
          contactName,
          contactPhone,
          guests,
          activityOptions: []
        }
      });

      return {
        bookingId: booking.id,
        amount: bookingTotal,
        paymentReference: razorpayOrderId,
        razorpayOrderId
      };
    }

    const service = await prisma.service.findUnique({
      where: { id: input.itemId }
    });

    if (!service || !service.available) {
      throw new AppError(404, "Service not found or unavailable");
    }

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
    const bookingTotal = service.price * quantity + addOnTotal;
    const receiptId = `rec_svc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const razorpayOrderId = await generatePaymentReference(bookingTotal, receiptId);

    const booking = await prisma.booking.create({
      data: {
        userId,
        kind: input.kind,
        serviceId: service.id,
        quantity,
        amount: bookingTotal,
        paymentProvider: "RAZORPAY",
        razorpayOrderId: razorpayOrderId,
        paymentStatus: PaymentStatus.PENDING,
        activityOptions: selectedActivityOptions,
        bookedFor: bookedForDate,
        checkInDate: bookedForDate,
        contactName,
        contactPhone,
        guests
      }
    });

    return {
      bookingId: booking.id,
      amount: bookingTotal,
      paymentReference: razorpayOrderId,
      razorpayOrderId
    };
  }

  async confirmPaidViaRazorpayOrder(razorpayOrderId: string, razorpayPaymentId: string) {
    const booking = await prisma.booking.findFirst({ where: { razorpayOrderId: razorpayOrderId } });
    if (!booking) {
      return null;
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

  async failViaRazorpayOrder(razorpayOrderId: string) {
    const booking = await prisma.booking.findFirst({ where: { razorpayOrderId: razorpayOrderId } });
    if (!booking) {
      return null;
    }
    await prisma.booking.updateMany({
      where: { id: booking.id, paymentStatus: PaymentStatus.PENDING },
      data: { paymentStatus: PaymentStatus.FAILED }
    });
    return booking;
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

    if (!trusted && input.success) {
      const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = input;
      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        throw new AppError(400, "Missing Razorpay verification credentials.");
      }

      const { RAZORPAY_KEY_SECRET } = env;
      if (!RAZORPAY_KEY_SECRET) {
        throw new AppError(500, "Razorpay secret key is not configured on the server.");
      }

      if (booking.razorpayOrderId !== razorpayOrderId) {
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
    const finalRazorpayPaymentId = input.razorpayPaymentId ?? booking.razorpayPaymentId ?? "";

    let updated;
    if (input.success) {
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
              data: { paymentStatus: PaymentStatus.SUCCESS, razorpayPaymentId: finalRazorpayPaymentId, paymentReference: finalRazorpayPaymentId },
              include
            });
          },
          { isolationLevel: "Serializable" }
        );
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 409) {
          await prisma.booking
            .update({ where: { id: booking.id }, data: { paymentStatus: PaymentStatus.FAILED } })
            .catch(() => undefined);
        }
        throw error;
      }
    } else {
      updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: PaymentStatus.FAILED, razorpayPaymentId: finalRazorpayPaymentId, paymentReference: finalRazorpayPaymentId },
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
