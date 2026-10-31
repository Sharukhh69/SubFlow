import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@brightloop.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const adminHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Super Admin',
      passwordHash: adminHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ Admin created: ${admin.email}`);

  // Sequence counters
  await prisma.sequenceCounter.upsert({
    where: { name: 'subscription' },
    update: {},
    create: { name: 'subscription', lastValue: 0 },
  });
  await prisma.sequenceCounter.upsert({
    where: { name: 'invoice' },
    update: {},
    create: { name: 'invoice', lastValue: 0 },
  });

  console.log('✅ Sequence counters initialized');
  console.log('\n🎉 Seed complete! Demo credentials:');
  console.log('  Admin:', adminEmail, '/', adminPassword);
  console.log('  (Run full seed after backend is working for complete demo data)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
