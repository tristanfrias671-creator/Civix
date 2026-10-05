const { PrismaClient } = require('@prisma/client');

// One database connection pool for the whole server. Each PrismaClient opens its
// own pool, and shared hosting allows only a few MySQL connections, so separate
// pools in every file could run the database out of connections during a flood of
// requests. DB_CONNECTION_LIMIT (default 5) caps this pool unless DATABASE_URL
// already sets connection_limit. When all connections are busy, queries wait their
// turn (up to Prisma's pool timeout) instead of opening more.
function withConnectionLimit(url) {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  const limit = Number(process.env.DB_CONNECTION_LIMIT) || 5;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${limit}`;
}

const url = withConnectionLimit(process.env.DATABASE_URL);
const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

module.exports = prisma;
