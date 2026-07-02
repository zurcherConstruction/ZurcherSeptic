require('dotenv').config();
const { Client } = require('pg');

const connectionString = process.env.DB_DEPLOY;

if (!connectionString) {
  console.error('❌ DB_DEPLOY no está definido en el .env');
  process.exit(1);
}

const SQL = `
  CREATE TABLE IF NOT EXISTS "NotificationRoutings" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  VARCHAR(50) NOT NULL UNIQUE,
    staff_id    UUID NOT NULL REFERENCES "Staffs"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Conectado a DB_DEPLOY');
    await client.query(SQL);
    console.log('✅ Tabla NotificationRoutings creada (o ya existía)');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
