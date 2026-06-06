import { BookingKind, PaymentStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";

/**
 * Date-based inventory for rooms and services.
 *
 * A room booking consumes 1 unit for every night in [checkInDate, checkOutDate)
 * (the room `quantity` field is the number of nights, used only for pricing).
 * A service booking consumes `quantity` units on its single `bookedFor` date.
 *
 * A booking occupies a unit when it is paid (SUCCESS) or it is a PENDING booking
 * created within the last HOLD_WINDOW_MS (a soft hold while the user is paying so
 * the last unit can't be double-sold).
 */

const HOLD_WINDOW_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AvailabilityDay = {
  date: string; // YYYY-MM-DD
  capacity: number;
  booked: number;
  available: number;
  isOverride: boolean;
};

type TxClient = Prisma.TransactionClient | PrismaClient;

/** Floor a Date to UTC midnight of its calendar day. */
const toUtcDate = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

/** YYYY-MM-DD key for a UTC-floored date. */
const dateKey = (value: Date): string => toUtcDate(value).toISOString().slice(0, 10);

/** Inclusive list of UTC midnights for each night in [from, to). */
const eachNight = (from: Date, to: Date): Date[] => {
  const start = toUtcDate(from);
  const end = toUtcDate(to);
  const nights: Date[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += DAY_MS) {
    nights.push(new Date(t));
  }
  return nights;
};

/** A booking occupies inventory when paid, or held as a recent PENDING. */
const occupiesFilter = (): Prisma.BookingWhereInput => ({
  OR: [
    { paymentStatus: PaymentStatus.SUCCESS },
    {
      paymentStatus: PaymentStatus.PENDING,
      createdAt: { gt: new Date(Date.now() - HOLD_WINDOW_MS) }
    }
  ]
});

class AvailabilityService {
  /** Per-night availability for a room across [from, to). */
  async getRoomAvailability(roomId: string, from: Date, to: Date, db: TxClient = prisma): Promise<AvailabilityDay[]> {
    const room = await db.room.findUnique({ where: { id: roomId }, select: { totalUnits: true } });
    if (!room) {
      throw new AppError(404, "Room not found");
    }

    const windowStart = toUtcDate(from);
    const windowEnd = toUtcDate(to);

    const [overrides, bookings] = await Promise.all([
      db.availabilityOverride.findMany({
        where: { roomId, date: { gte: windowStart, lt: windowEnd } }
      }),
      db.booking.findMany({
        where: {
          roomId,
          kind: BookingKind.ROOM,
          checkInDate: { lt: windowEnd },
          checkOutDate: { gt: windowStart },
          ...occupiesFilter()
        },
        select: { checkInDate: true, checkOutDate: true }
      })
    ]);

    const overrideByDate = new Map(overrides.map((o) => [dateKey(o.date), o.units]));

    // Count occupied units per night.
    const bookedByDate = new Map<string, number>();
    for (const booking of bookings) {
      if (!booking.checkInDate || !booking.checkOutDate) continue;
      for (const night of eachNight(booking.checkInDate, booking.checkOutDate)) {
        const key = dateKey(night);
        bookedByDate.set(key, (bookedByDate.get(key) ?? 0) + 1);
      }
    }

    return eachNight(windowStart, windowEnd).map((night) => {
      const key = dateKey(night);
      const override = overrideByDate.get(key);
      const capacity = override ?? room.totalUnits;
      const booked = bookedByDate.get(key) ?? 0;
      return {
        date: key,
        capacity,
        booked,
        available: Math.max(capacity - booked, 0),
        isOverride: override !== undefined
      };
    });
  }

  /** Per-date availability for a service across [from, to). */
  async getServiceAvailability(serviceId: string, from: Date, to: Date, db: TxClient = prisma): Promise<AvailabilityDay[]> {
    const service = await db.service.findUnique({ where: { id: serviceId }, select: { totalUnits: true } });
    if (!service) {
      throw new AppError(404, "Service not found");
    }

    const windowStart = toUtcDate(from);
    const windowEnd = toUtcDate(to);

    const [overrides, bookings] = await Promise.all([
      db.availabilityOverride.findMany({
        where: { serviceId, date: { gte: windowStart, lt: windowEnd } }
      }),
      db.booking.findMany({
        where: {
          serviceId,
          kind: BookingKind.SERVICE,
          bookedFor: { gte: windowStart, lt: windowEnd },
          ...occupiesFilter()
        },
        select: { bookedFor: true, quantity: true }
      })
    ]);

    const overrideByDate = new Map(overrides.map((o) => [dateKey(o.date), o.units]));

    const bookedByDate = new Map<string, number>();
    for (const booking of bookings) {
      if (!booking.bookedFor) continue;
      const key = dateKey(booking.bookedFor);
      bookedByDate.set(key, (bookedByDate.get(key) ?? 0) + (booking.quantity ?? 1));
    }

    return eachNight(windowStart, windowEnd).map((day) => {
      const key = dateKey(day);
      const override = overrideByDate.get(key);
      const capacity = override ?? service.totalUnits;
      const booked = bookedByDate.get(key) ?? 0;
      return {
        date: key,
        capacity,
        booked,
        available: Math.max(capacity - booked, 0),
        isOverride: override !== undefined
      };
    });
  }

  /**
   * Throw 409 if any night in [checkIn, checkOut) cannot fit one more room unit.
   * `excludeBookingId` skips a booking's own held PENDING row (used at confirm time).
   */
  async assertRoomAvailable(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    db: TxClient = prisma,
    excludeBookingId?: string
  ): Promise<void> {
    const room = await db.room.findUnique({ where: { id: roomId }, select: { totalUnits: true } });
    if (!room) {
      throw new AppError(404, "Room not found");
    }

    const windowStart = toUtcDate(checkIn);
    const windowEnd = toUtcDate(checkOut);

    const [overrides, bookings] = await Promise.all([
      db.availabilityOverride.findMany({
        where: { roomId, date: { gte: windowStart, lt: windowEnd } }
      }),
      db.booking.findMany({
        where: {
          roomId,
          kind: BookingKind.ROOM,
          checkInDate: { lt: windowEnd },
          checkOutDate: { gt: windowStart },
          ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
          ...occupiesFilter()
        },
        select: { checkInDate: true, checkOutDate: true }
      })
    ]);

    const overrideByDate = new Map(overrides.map((o) => [dateKey(o.date), o.units]));
    const bookedByDate = new Map<string, number>();
    for (const booking of bookings) {
      if (!booking.checkInDate || !booking.checkOutDate) continue;
      for (const night of eachNight(booking.checkInDate, booking.checkOutDate)) {
        const key = dateKey(night);
        bookedByDate.set(key, (bookedByDate.get(key) ?? 0) + 1);
      }
    }

    for (const night of eachNight(windowStart, windowEnd)) {
      const key = dateKey(night);
      const capacity = overrideByDate.get(key) ?? room.totalUnits;
      const booked = bookedByDate.get(key) ?? 0;
      if (capacity - booked < 1) {
        throw new AppError(409, "This room just sold out for one or more of the selected dates. Please pick another date.");
      }
    }
  }

  /** Throw 409 if `qty` service units can't fit on `date`. */
  async assertServiceAvailable(
    serviceId: string,
    date: Date,
    qty: number,
    db: TxClient = prisma,
    excludeBookingId?: string
  ): Promise<void> {
    const service = await db.service.findUnique({ where: { id: serviceId }, select: { totalUnits: true } });
    if (!service) {
      throw new AppError(404, "Service not found");
    }

    const dayStart = toUtcDate(date);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    const [override, bookings] = await Promise.all([
      db.availabilityOverride.findUnique({
        where: { serviceId_date: { serviceId, date: dayStart } }
      }),
      db.booking.findMany({
        where: {
          serviceId,
          kind: BookingKind.SERVICE,
          bookedFor: { gte: dayStart, lt: dayEnd },
          ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
          ...occupiesFilter()
        },
        select: { quantity: true }
      })
    ]);

    const capacity = override?.units ?? service.totalUnits;
    const booked = bookings.reduce((sum, b) => sum + (b.quantity ?? 1), 0);
    if (capacity - booked < qty) {
      const left = Math.max(capacity - booked, 0);
      throw new AppError(409, `Only ${left} left for the selected date. Please reduce the quantity or pick another date.`);
    }
  }
}

export const availabilityService = new AvailabilityService();
export { toUtcDate };
