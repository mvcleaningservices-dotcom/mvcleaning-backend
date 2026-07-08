import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MongooseModuleOptions } from '@nestjs/mongoose';

/**
 * Resolves the MongoDB connection.
 *
 * - If MONGODB_URI is set (Atlas, or any real Mongo), use it. Required in production.
 * - If it's empty AND we're in development, spin up an in-memory MongoDB so the app
 *   runs offline without an Atlas account. Handy for building/testing each phase.
 *
 * Production MUST provide a real MONGODB_URI — we refuse to start on in-memory in prod.
 */
export async function buildMongooseOptions(
  config: ConfigService,
): Promise<MongooseModuleOptions> {
  const logger = new Logger('Database');
  const uri = config.get<string>('database.uri');
  const env = config.get<string>('env');

  if (uri) {
    logger.log('Connecting to configured MongoDB (MONGODB_URI)');
    return { uri };
  }

  if (env === 'production') {
    throw new Error(
      'MONGODB_URI is required in production. Set it in the environment.',
    );
  }

  // Dev fallback: in-memory Mongo (no external account needed)
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  const memUri = mem.getUri();
  logger.warn(
    'MONGODB_URI not set — using in-memory MongoDB for development only. ' +
      'Data is NOT persisted. Set MONGODB_URI (Atlas) before production.',
  );
  return { uri: memUri };
}
