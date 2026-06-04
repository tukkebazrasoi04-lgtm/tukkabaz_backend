import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'shubhamkarmyal20@gmail.com';
  
  // Find user
  const user = await prisma.user.findUnique({
    where: { email }
  });
  
  if (!user) {
    console.log(`User ${email} not found in database.`);
    return;
  }
  
  console.log(`Found user: ${user.name} (${user.email}) currently with role ${user.role}`);
  
  // Update role to CUSTOMER
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: 'CUSTOMER' }
  });
  
  console.log(`Successfully reset role of ${email} to ${updatedUser.role}`);
  
  // Check associated DeliveryPartner profile
  const partner = await prisma.deliveryPartner.findUnique({
    where: { userId: user.id }
  });
  
  if (partner) {
    console.log(`Associated DeliveryPartner profile found with status ${partner.profileStatus}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
