import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log('Terminating other active database sessions to release locks...');
  try {
    // Run the session termination query
    const result = await prisma.$executeRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'neondb' AND pid <> pg_backend_pid();`
    );
    console.log('Successfully requested termination of other sessions. Result:', result);
  } catch (error) {
    console.error('Error terminating sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error in script:', err);
  process.exit(1);
});
