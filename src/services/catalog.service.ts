import { BookingKind, PaymentStatus, ServiceType, type Room, type Service } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";

const defaultRooms = [
  {
    title: "Premium Valley View Stay",
    description:
      "Spacious room with mountain view, breakfast, and high-speed Wi-Fi. A peaceful Mukteshwar stay made for slow mornings, fresh air, and easy access to nearby cafes and viewpoints.\n\nThe space\nThis private room is designed for comfort after a day out in the hills. Large windows bring in natural light and open views, while the bedroom setup keeps things simple, clean, and restful. Guests get a comfortable bed, reliable Wi-Fi, and access to food support during the stay.\n\nThe property sits in Village Satkhol, close enough for local exploring but quiet enough for a proper break. Free parking is available, and the owner can help with quick support before and during your visit.",
    price: 3200,
    imageUrl:
      "https://res.cloudinary.com/dyt47bujk/image/upload/f_auto,q_auto,w_1400/v1777541319/jpeg-optimizer_DSC06129-HDR_zxjujq.jpg",
    imageUrls: [
      "https://res.cloudinary.com/dyt47bujk/image/upload/f_auto,q_auto,w_1400/v1777541319/jpeg-optimizer_DSC06129-HDR_zxjujq.jpg",
      "https://res.cloudinary.com/dyt47bujk/image/upload/f_auto,q_auto,w_1400/v1777541318/jpeg-optimizer_DSC06214-HDR_rkuk5r.jpg",
      "https://res.cloudinary.com/dyt47bujk/image/upload/f_auto,q_auto,w_1400/v1777541332/jpeg-optimizer_DSC06186-HDR_qr9uup.jpg",
      "https://res.cloudinary.com/dyt47bujk/image/upload/f_auto,q_auto,w_1400/v1777541313/jpeg-optimizer_DSC06224-HDR_e58ipo.jpg"
    ],
    roomPhotoTypes: ["Bedroom", "Bathroom", "Exterior", "Bedroom area"],
    roomPhotos: [
      {
        type: "Bedroom",
        urls: [
          "https://res.cloudinary.com/dyt47bujk/image/upload/f_auto,q_auto,w_1400/v1777541319/jpeg-optimizer_DSC06129-HDR_zxjujq.jpg",
          "https://res.cloudinary.com/dyt47bujk/image/upload/f_auto,q_auto,w_1400/v1777541313/jpeg-optimizer_DSC06224-HDR_e58ipo.jpg"
        ]
      },
      {
        type: "Bathroom",
        urls: ["https://res.cloudinary.com/dyt47bujk/image/upload/f_auto,q_auto,w_1400/v1777541318/jpeg-optimizer_DSC06214-HDR_rkuk5r.jpg"]
      },
      {
        type: "Exterior",
        urls: ["https://res.cloudinary.com/dyt47bujk/image/upload/f_auto,q_auto,w_1400/v1777541332/jpeg-optimizer_DSC06186-HDR_qr9uup.jpg"]
      }
    ],
    address: "Village Satkhol, Mukteshwar, Uttarakhand",
    ownerPhone: "+919876543210",
    tags: ["Free WiFi", "Food Available", "1 Bed"],
    amenities: ["Free WiFi", "Food Available", "Free parking", "Mountain view"],
    unavailableAmenities: [],
    sleepTitle: "Bedroom",
    sleepDescription: "1 bed",
    latitude: 29.4765,
    longitude: 79.6471,
    capacity: 2
  },
  {
    title: "Wooden Cottage Resort",
    description:
      "Warm wooden interiors, private sit-out, and sunrise view. A cozy cottage-style stay near Chauli Ki Jali with room for friends, family, or a relaxed mountain weekend.\n\nThe space\nThis cottage brings together wooden finishes, a private sit-out, and bright morning views. The bedroom arrangement works well for small groups, with three beds and enough space to settle in comfortably after exploring Mukteshwar.\n\nGuests can enjoy Wi-Fi, food availability, free parking, and a calm outdoor corner for tea, reading, or quiet conversations. The location keeps you close to local viewpoints while still giving the stay a tucked-away feel.",
    price: 4200,
    imageUrl:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
    imageUrls: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80"
    ],
    roomPhotoTypes: ["Exterior", "Bedroom", "Bathroom"],
    roomPhotos: [
      {
        type: "Exterior",
        urls: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80"]
      },
      {
        type: "Bedroom",
        urls: [
          "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=80",
          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80"
        ]
      },
      {
        type: "Bathroom",
        urls: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80"]
      }
    ],
    address: "Near Chauli Ki Jali, Mukteshwar, Uttarakhand",
    ownerPhone: "+919112223334",
    tags: ["Free WiFi", "Food Available", "3 Beds"],
    amenities: ["Free WiFi", "Food Available", "Private sit-out", "Free parking"],
    unavailableAmenities: [],
    sleepTitle: "Bedroom",
    sleepDescription: "3 beds",
    latitude: 29.4728,
    longitude: 79.6423,
    capacity: 3
  }
];

const defaultServices = [
  {
    title: "Scooty Rental",
    description: "Daily self-drive scooty rental for nearby stays, cafes, and viewpoints.",
    price: 900,
    imageUrl:
      "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80",
    imageUrls: [
      "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80"
    ],
    type: ServiceType.RENT_SCOOTY,
    detailSections: [
      {
        title: "Booking procedure",
        items: [
          "Contact the owner and confirm your pickup time.",
          "Share licence and ID proof before pickup.",
          "Collect the scooty, helmet, and local route tips."
        ]
      },
      {
        title: "Pickup support",
        body: "Get directions to the pickup point or contact the owner before you start."
      }
    ],
    activityOptions: [],
    requiredDocuments: [
      "Driving licence",
      "Aadhaar or government ID",
      "Refundable security deposit if requested"
    ],
    pickupAddress: "Main Market, Mukteshwar, Uttarakhand",
    contactPhone: "+919876543210",
    latitude: 29.4728,
    longitude: 79.6423,
    ctaLabel: "Contact now"
  },
  {
    title: "Cab and Taxi Service",
    description: "Book or call a cab or taxi for local sightseeing, outstation, or station pickups.",
    price: 3500,
    imageUrl:
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80",
    imageUrls: [
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80"
    ],
    type: ServiceType.CAB_AND_TAXI,
    detailSections: [
      {
        title: "Booking procedure",
        items: [
          "Choose your destination and confirm fare with driver.",
          "Cabs are available for local sightseeing and outstation drops.",
          "Clean vehicles with professional local drivers."
        ]
      },
      {
        title: "Important info",
        body: "Tolls, parking fees, and driver allowance are included or charged as extra depending on route."
      }
    ],
    activityOptions: [
      {
        id: "half-day-ext",
        title: "Extend to Full Day",
        description: "Upgrade from half-day (4 hrs) to full-day cab (8 hrs).",
        pricePerGuest: 1500
      }
    ],
    contactPhone: "+919876543210",
    ctaLabel: "Call Cab Driver"
  },
  {
    title: "Camping Experience",
    description: "Overnight camping package with bonfire and meals.",
    price: 2600,
    imageUrl:
      "https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=1200&q=80",
    imageUrls: [
      "https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504851149312-7a075b496cc7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1445307806294-bff7f67ff225?auto=format&fit=crop&w=1200&q=80"
    ],
    type: ServiceType.CAMPING,
    detailSections: [
      {
        title: "What you will do",
        items: [
          "Reach the campsite and check your tent setup.",
          "Enjoy bonfire time and included meals.",
          "Wake up to the mountain view and check out with host support."
        ]
      },
      {
        title: "Things to know",
        body: "Warm clothing is recommended. Final campsite details are confirmed after booking."
      }
    ],
    activityOptions: [
      {
        id: "bonfire-upgrade",
        title: "Bonfire upgrade",
        description: "Extra bonfire setup support for the group.",
        pricePerGuest: 300
      },
      {
        id: "breakfast-add-on",
        title: "Breakfast add-on",
        description: "Add morning breakfast to the camping plan.",
        pricePerGuest: 220
      }
    ],
    contactPhone: "+919876543210",
    ctaLabel: "Book now"
  },
  {
    title: "Drone Shoot",
    description: "Professional drone shoot for your trip memories.",
    price: 2200,
    imageUrl:
      "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80",
    imageUrls: [
      "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1200&q=80"
    ],
    type: ServiceType.DRONE_SHOOT,
    detailSections: [
      {
        title: "What you will do",
        items: [
          "Choose a nearby shoot location with the operator.",
          "Capture scenic aerial shots and short clips.",
          "Receive edited files after the shoot window."
        ]
      },
      {
        title: "Things to know",
        body: "Drone flying depends on weather and local permission. Final timing is confirmed after booking."
      }
    ],
    activityOptions: [
      {
        id: "extra-edits",
        title: "Extra edited reel",
        description: "Add one extra short edited reel from the shoot.",
        pricePerGuest: 500
      },
      {
        id: "extended-shoot",
        title: "Extended shoot time",
        description: "Add more shoot time for extra locations.",
        pricePerGuest: 700
      }
    ],
    contactPhone: "+919876543210",
    ctaLabel: "Book now"
  },
  {
    title: "Trekking & Camping Package",
    description: "Guided valley trek with overnight camp stay, meals, and bonfire.",
    price: 3800,
    imageUrl:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",
    imageUrls: [
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1533240332313-0db49b439ad3?auto=format&fit=crop&w=1200&q=80"
    ],
    type: ServiceType.TREKKING_WITH_CAMPING,
    detailSections: [
      {
        title: "Itinerary",
        items: [
          "Day 1: Start 3-hour guided valley trek at 10 AM.",
          "Day 1: Reach mountain camp, check-in, sunset snacks & bonfire dinner.",
          "Day 2: Morning valley views, breakfast, and return trek."
        ]
      },
      {
        title: "What's included",
        body: "Professional guide, sleeping bags, dome tents, evening bonfire, dinner, and breakfast."
      }
    ],
    activityOptions: [
      {
        id: "sleeping-bag-up",
        title: "Premium Thermal Sleeping Bag",
        description: "Upgrade to extreme cold weather sleeping bags.",
        pricePerGuest: 200
      }
    ],
    requiredDocuments: [
      "Aadhaar card or government ID"
    ],
    pickupAddress: "Adventure Hub satkhol, Mukteshwar, Uttarakhand",
    contactPhone: "+919876543210",
    latitude: 29.4765,
    longitude: 79.6471,
    ctaLabel: "Book Trek Now"
  }
];

class CatalogService {
  async ensureCatalogSeeded(): Promise<void> {
    const [roomCount, serviceCount] = await Promise.all([
      prisma.room.count(),
      prisma.service.count()
    ]);

    if (roomCount === 0) {
      await prisma.room.createMany({
        data: defaultRooms
      });
    }

    if (serviceCount === 0) {
      await prisma.service.createMany({
        data: defaultServices
      });
    }
  }

  async getRooms(includeUnavailable = false): Promise<Room[]> {
    return prisma.room.findMany({
      where: includeUnavailable ? {} : { available: true },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async getServices(includeUnavailable = false): Promise<Service[]> {
    return prisma.service.findMany({
      where: includeUnavailable ? {} : { available: true },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async getRoomById(roomId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room || !room.available) {
      throw new AppError(404, "Room not found");
    }

    const [reviewAggregate, successfulBookings] = await Promise.all([
      prisma.roomReview.aggregate({
        where: { roomId },
        _avg: { rating: true },
        _count: { _all: true }
      }),
      prisma.booking.count({
        where: {
          roomId,
          kind: BookingKind.ROOM,
          paymentStatus: PaymentStatus.SUCCESS
        }
      })
    ]);

    return {
      room,
      trust: {
        successfulBookings,
        averageRating: reviewAggregate._avg.rating
          ? Number(reviewAggregate._avg.rating.toFixed(1))
          : null,
        reviewCount: reviewAggregate._count._all
      }
    };
  }

  async getRoomReviews(roomId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true }
    });

    if (!room) {
      throw new AppError(404, "Room not found");
    }

    const [reviews, aggregate] = await Promise.all([
      prisma.roomReview.findMany({
        where: { roomId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              picture: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }),
      prisma.roomReview.aggregate({
        where: { roomId },
        _avg: { rating: true },
        _count: { _all: true }
      })
    ]);

    return {
      reviews,
      summary: {
        averageRating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : null,
        reviewCount: aggregate._count._all
      }
    };
  }

  async getReviewEligibility(userId: string, roomId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true }
    });

    if (!room) {
      throw new AppError(404, "Room not found");
    }

    const now = new Date();

    const [successfulBooking, completedBooking, existingReview] = await Promise.all([
      prisma.booking.findFirst({
        where: {
          userId,
          roomId,
          kind: BookingKind.ROOM,
          paymentStatus: PaymentStatus.SUCCESS
        },
        select: { id: true }
      }),
      prisma.booking.findFirst({
        where: {
          userId,
          roomId,
          kind: BookingKind.ROOM,
          paymentStatus: PaymentStatus.SUCCESS,
          OR: [
            {
              checkOutDate: {
                not: null,
                lt: now
              }
            },
            {
              checkOutDate: null,
              bookedFor: {
                not: null,
                lt: now
              }
            }
          ]
        },
        select: { id: true, bookedFor: true, checkInDate: true, checkOutDate: true }
      }),
      prisma.roomReview.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId
          }
        }
      })
    ]);

    return {
      canReview: Boolean(completedBooking),
      hasPurchased: Boolean(successfulBooking),
      hasCompletedStay: Boolean(completedBooking),
      existingReview
    };
  }

  async createOrUpdateRoomReview(
    userId: string,
    roomId: string,
    input: { rating: number; comment: string }
  ) {
    const completedBooking = await prisma.booking.findFirst({
      where: {
        userId,
        roomId,
        kind: BookingKind.ROOM,
        paymentStatus: PaymentStatus.SUCCESS,
        OR: [
          {
            checkOutDate: {
              not: null,
              lt: new Date()
            }
          },
          {
            checkOutDate: null,
            bookedFor: {
              not: null,
              lt: new Date()
            }
          }
        ]
      },
      select: { id: true }
    });

    if (!completedBooking) {
      throw new AppError(403, "You can review this room only after your booked stay date has passed.");
    }

    const review = await prisma.roomReview.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      },
      create: {
        roomId,
        userId,
        rating: input.rating,
        comment: input.comment.trim()
      },
      update: {
        rating: input.rating,
        comment: input.comment.trim()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            picture: true
          }
        }
      }
    });

    return {
      message: "Review saved",
      review
    };
  }
}

export const catalogService = new CatalogService();
