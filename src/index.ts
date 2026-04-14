import { initDatabase } from './db.js';

async function main() {
  await initDatabase();
  console.log('Database initialized successfully.');
}

main().catch((error) => {
  console.error('Initialization failed:', error);
  process.exit(1);
});
