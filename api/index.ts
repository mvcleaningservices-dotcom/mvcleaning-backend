import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

/**
 * Vercel serverless entry point for the NestJS API.
 *
 * Vercel invokes a function per request instead of running a server, so we boot
 * the Nest app ONCE and reuse it while the instance stays warm — only a cold
 * start pays the boot cost. The Mongo connection opened during init() is reused
 * the same way (see maxPoolSize/minPoolSize in config/database.ts, which keep a
 * warm instance from hoarding Atlas connections).
 *
 * We cache the boot PROMISE, not the resolved app: two requests can hit a cold
 * instance at the same moment, and caching the promise makes them share a single
 * boot instead of racing two — which would open two apps and two connections.
 *
 * app.init() wires the DI container and routes but does NOT open a port — the
 * one thing that must differ from main.ts. Everything else comes from
 * configureApp() so local and serverless behave identically.
 */
let cached: Promise<Express> | null = null;

async function createServer(): Promise<Express> {
  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { rawBody: true },
  );
  configureApp(app);
  await app.init();
  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  if (!cached) cached = createServer();
  const server = await cached;
  server(req, res);
}

// Exported for a local boot smoke-test; not used by Vercel.
export { createServer };
