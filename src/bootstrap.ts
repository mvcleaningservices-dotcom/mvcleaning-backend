import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

/**
 * Apply the SAME middleware, pipes and prefix in every environment.
 *
 * There are now two entry points — `main.ts` (a long-running server for local
 * dev) and `api/index.ts` (a serverless handler for Vercel). If each configured
 * the app separately they would drift, and the bug would only show up in one
 * environment. Both call this instead, so what runs locally is what runs live.
 *
 * NOTE: `rawBody: true` is passed to NestFactory.create() at each call site, not
 * here — it's a creation option, not something you can add afterwards. Keep it
 * in both entry points or the Razorpay webhook signature check breaks.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // Security headers.
  app.use(helmet());

  // CORS: production locks to the configured origins (never '*'); local dev
  // reflects any origin so browser testing just works.
  const isDev = config.get<string>('env') !== 'production';
  app.enableCors({
    origin: isDev ? true : config.get<string[]>('corsOrigins'),
    credentials: true,
  });

  // Reject unknown/malformed payloads on every endpoint.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // All routes are served under /api.
  app.setGlobalPrefix('api');
}
