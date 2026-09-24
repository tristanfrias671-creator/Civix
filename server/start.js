const { spawnSync } = require('node:child_process');
const path = require('node:path');

const prismaCli = path.join(__dirname, 'node_modules', 'prisma', 'build', 'index.js');
const migration = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: __dirname,
  stdio: 'inherit',
});

if (migration.error) {
  console.error('Failed to run database migrations:', migration.error.message);
  process.exit(1);
}

if (migration.status !== 0) {
  process.exit(migration.status || 1);
}

// Keep the migration-only database credential out of the application process.
process.env.MIGRATION_DATABASE_URL = '';
require('./index');
