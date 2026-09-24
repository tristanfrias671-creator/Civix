const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo accounts and submissions in production.');
  }

  console.log('Seeding database...');

  const adminPass = await bcrypt.hash('admin123', 12);
  const citizenPass = await bcrypt.hash('citizen123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@civix.gov' },
    update: { password: adminPass },
    create: {
      fullName: 'System Administrator',
      citizenId: 'ADMIN-0001',
      email: 'admin@civix.gov',
      password: adminPass,
      role: 'ADMIN',
    },
  });

  const citizen = await prisma.user.upsert({
    where: { email: 'citizen@test.com' },
    update: { password: citizenPass },
    create: {
      fullName: 'Juan dela Cruz',
      citizenId: 'CIT-2025-001',
      email: 'citizen@test.com',
      password: citizenPass,
      role: 'CITIZEN',
    },
  });

  const submissions = [
    {
      trackingId: 'CIVIX-20250515-ABC123',
      type: 'COMPLAINT',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      description: 'There is a large pothole on the main road near the market that has been causing accidents. This is dangerous and needs urgent repair.',
      citizenDepartment: 'INFRASTRUCTURE',
      department: 'INFRASTRUCTURE',
      sentiment: 'NEGATIVE',
      userId: citizen.id,
      location: { create: { latitude: 14.5995, longitude: 120.9842 } },
    },
    {
      trackingId: 'CIVIX-20250516-DEF456',
      type: 'SUGGESTION',
      status: 'REVIEWING',
      priority: 'STANDARD',
      description: 'It would be great to have more recycling bins placed around the park area to help improve waste management and keep the area clean.',
      citizenDepartment: 'SANITATION',
      department: 'SANITATION',
      sentiment: 'POSITIVE',
      userId: citizen.id,
      location: { create: { latitude: 14.6010, longitude: 120.9860 } },
    },
    {
      trackingId: 'CIVIX-20250517-GHI789',
      type: 'FEEDBACK',
      status: 'RESOLVED',
      priority: 'LOW',
      description: 'The new streetlights installed last week are excellent! The neighborhood feels much safer now at night. Thank you for the quick implementation.',
      citizenDepartment: 'PUBLIC_SAFETY',
      department: 'PUBLIC_SAFETY',
      sentiment: 'POSITIVE',
      userId: citizen.id,
    },
    {
      trackingId: 'CIVIX-20250517-JKL012',
      type: 'COMPLAINT',
      status: 'PENDING',
      priority: 'URGENT',
      description: 'Flooding in Barangay 5 after heavy rain. Several houses are already waterlogged and residents need emergency assistance.',
      citizenDepartment: 'PUBLIC_SAFETY',
      department: 'PUBLIC_SAFETY',
      sentiment: 'NEGATIVE',
      userId: citizen.id,
      location: { create: { latitude: 14.5975, longitude: 120.9825 } },
    },
  ];

  for (const sub of submissions) {
    await prisma.submission.upsert({
      where: { trackingId: sub.trackingId },
      update: {},
      create: sub,
    });
  }

  await prisma.notification.createMany({
    data: [
      { userId: citizen.id, message: 'Your submission CIVIX-20250515-ABC123 is now in progress.', isRead: false },
      { userId: citizen.id, message: 'Your submission CIVIX-20250516-DEF456 is now being reviewed.', isRead: true },
      { userId: citizen.id, message: 'Your submission CIVIX-20250517-GHI789 has been resolved. Thank you!', isRead: false },
    ],
    skipDuplicates: true,
  });

  console.log('Seed complete!');
  console.log('Admin: admin@civix.gov / admin123');
  console.log('Citizen: citizen@test.com / citizen123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
