import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DeliveryPartner cleanup...');

  const allPartners = await prisma.deliveryPartner.findMany({
    orderBy: { createdAt: 'desc' }
  });

  const seenPhones = new Set<string>();
  const toDelete: string[] = [];

  for (const partner of allPartners) {
    if (seenPhones.has(partner.phone as any)) {
      toDelete.push(partner.id);
    } else {
      seenPhones.add(partner.phone as any);
    }
  }

  if (toDelete.length > 0) {
    console.log(`Found ${toDelete.length} duplicate partners to delete.`);
    await prisma.deliveryPartner.deleteMany({
      where: {
        id: { in: toDelete }
      }
    });
    console.log('Duplicates deleted.');
  } else {
    console.log('No duplicates found.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
