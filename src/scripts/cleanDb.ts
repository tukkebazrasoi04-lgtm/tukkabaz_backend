import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning Service and Booking tables...");
  
  // Truncate tables to safely run enum migrations
  await prisma.booking.deleteMany();
  await prisma.service.deleteMany();
  
  console.log("Cleanup finished successfully!");
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
