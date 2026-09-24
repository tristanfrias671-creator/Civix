const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const fullName = process.env.CIVIX_ADMIN_NAME?.trim();
  const email = process.env.CIVIX_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.CIVIX_ADMIN_PASSWORD;

  if (!fullName || !email || !password) {
    throw new Error('Set CIVIX_ADMIN_NAME, CIVIX_ADMIN_EMAIL, and CIVIX_ADMIN_PASSWORD first.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('CIVIX_ADMIN_EMAIL must be a valid email address.');
  }

  const passwordBytes = Buffer.byteLength(password, 'utf8');
  if (passwordBytes < 16 || passwordBytes > 72) {
    throw new Error('CIVIX_ADMIN_PASSWORD must be 16 to 72 UTF-8 bytes long.');
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new Error('That email already belongs to an account; no account was changed.');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      fullName,
      citizenId: `ADMIN-${randomUUID()}`,
      email,
      password: hashedPassword,
      role: 'ADMIN',
    },
    select: { id: true, email: true },
  });

  console.log(`Created the initial administrator account (${admin.email}).`);
  console.log('Remove CIVIX_ADMIN_PASSWORD from the service variables after this one-time command.');
}

main()
  .catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
