import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

/**
 * Local / self-hosted entry point: a long-running HTTP server.
 *
 * Vercel does NOT use this file — it calls the serverless handler in
 * `api/index.ts`. Both share configureApp() so they stay identical; the only
 * difference is this one calls listen() and that one calls init().
 */
async function bootstrap() {
  // rawBody: true lets the Razorpay webhook verify the signature over the exact
  // bytes received (JSON re-serialization would break the HMAC).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const port = config.get<number>('port') ?? 3000;

  await app.listen(port);
  logger.log(`🚀 API running on http://localhost:${port}/api`);
  logger.log(`   Health check: http://localhost:${port}/api/health`);
}
bootstrap();
