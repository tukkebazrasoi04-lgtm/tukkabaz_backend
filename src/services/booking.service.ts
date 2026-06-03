import { BookingKind, PaymentStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { notifyAdminNewBooking } from "../utils/notify-admin";

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
};

type ConfirmBookingPaymentInput = {
  bookingId: string;
  paymentReference?: string;
  success: boolean;
};

class BookingService {
  async createBookingIntent(userId: string, input: CreateBookingIntentInput) {
    const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;
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

      const amount = room.price * quantity;
      const paymentReference = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
          checkOutDate
        }
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

    const selectedActivityOptions = (input.activityOptions ?? []).map((option) => ({
      id: option.id,
      title: option.title,
      description: option.description,
      pricePerGuest: Number.isFinite(option.pricePerGuest) ? Math.max(Math.floor(option.pricePerGuest), 0) : 0
    }));
    const addOnTotal = selectedActivityOptions.reduce((sum, option) => sum + option.pricePerGuest * quantity, 0);
    const amount = service.price * quantity + addOnTotal;
    const paymentReference = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
        checkOutDate
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

  async confirmBookingPayment(userId: string, input: ConfirmBookingPaymentInput) {
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

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: input.success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
        paymentReference: input.paymentReference ?? booking.paymentReference
      },
      include: {
        room: true,
        service: true,
        user: true
      }
    });

    if (input.success) {
      notifyAdminNewBooking({
        userName: updated.user.name ?? 'Guest',
        itemTitle: updated.kind === 'ROOM' && updated.room ? updated.room.title : updated.service ? updated.service.title : 'Unknown',
        kind: updated.kind,
        amount: updated.amount,
        reference: updated.paymentReference,
        checkIn: updated.checkInDate ? updated.checkInDate.toISOString().split('T')[0] : null,
        checkOut: updated.checkOutDate ? updated.checkOutDate.toISOString().split('T')[0] : null
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
