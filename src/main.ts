import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security headers
  app.use(helmet());

  // CORS locked to known origins (admin panel) — never '*'
  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: true,
  });

  // Global input validation — reject unknown/malformed payloads on every endpoint
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not in the DTO
      forbidNonWhitelisted: true, // 400 on unexpected properties
      transform: true, // auto-convert payloads to DTO types
    }),
  );

  // All routes prefixed with /api
  app.setGlobalPrefix('api');

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  logger.log(`🚀 API running on http://localhost:${port}/api`);
  logger.log(`   Health check: http://localhost:${port}/api/health`);
}
bootstrap();
