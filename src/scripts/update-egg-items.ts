import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

async function main() {
  logger.info("Connecting to database to search and update egg items...");

  // 1. Fetch all delivery items to see what is currently in the database
  const items = await prisma.deliveryItem.findMany();
  logger.info(`Found ${items.length} delivery items total in the database.`);

  let eggSandwichCount = 0;
  let eggBhurjiCount = 0;

  for (const item of items) {
    const lowercaseName = item.name.toLowerCase();
    
    // Search for egg sandwich variants (e.g. egg sandwich, egg swanedh)
    if (lowercaseName.includes("egg") && (lowercaseName.includes("sandwich") || lowercaseName.includes("swanedh") || lowercaseName.includes("sandwitch"))) {
      logger.info(`Updating Egg Sandwich item: "${item.name}" (ID: ${item.id})`);
      await prisma.deliveryItem.update({
        where: { id: item.id },
        data: {
          pieces: "2pc",
          servingInfo: "200 g"
        }
      });
      eggSandwichCount++;
    }
    // Search for egg bhurji variants
    else if (lowercaseName.includes("egg") && (lowercaseName.includes("bhurji") || lowercaseName.includes("burji"))) {
      logger.info(`Updating Egg Bhurji item: "${item.name}" (ID: ${item.id})`);
      await prisma.deliveryItem.update({
        where: { id: item.id },
        data: {
          pieces: "1 egg",
          servingInfo: "1 portion"
        }
      });
      eggBhurjiCount++;
    }
  }

  logger.info(`Migration completed: updated ${eggSandwichCount} Egg Sandwich items, ${eggBhurjiCount} Egg Bhurji items.`);

  // Print all food items in DB to let user verify what exists
  const updatedItems = await prisma.deliveryItem.findMany({
    where: { category: "FOOD" }
  });
  logger.info("Current Food items in database:");
  for (const food of updatedItems) {
    logger.info(`- Name: "${food.name}" | Pieces: "${food.pieces}" | ServingInfo: "${food.servingInfo}" | Price: ${food.price}`);
  }
}

main()
  .catch((err) => {
    logger.error("Failed to run egg items database update", { err });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
