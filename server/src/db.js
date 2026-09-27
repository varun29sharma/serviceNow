/**
 * Mongo connection with a zero-setup fallback.
 *
 * Default: mongodb://127.0.0.1:27017/triagenow (set MONGODB_URI to override).
 * USE_MEMORY_DB=1: spins up an in-memory MongoDB (mongodb-memory-server) so
 * a teammate without Mongo installed can still run the whole app locally.
 */
import mongoose from 'mongoose';

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/triagenow';

export async function connectDb() {
  if (process.env.USE_MEMORY_DB === '1') {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mem = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mem.getUri('triagenow');
    console.log('[db] Using in-memory MongoDB (USE_MEMORY_DB=1)');
  }

  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  await mongoose.connect(uri);
  console.log(`[db] Connected: ${mongoose.connection.name}`);
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
