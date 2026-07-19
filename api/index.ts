import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
// IMPORTANT: import the COMPILED app from dist/, not the TypeScript in src/.
//
// Vercel builds this function with esbuild, and esbuild does NOT emit the
// decorator metadata that NestJS/Mongoose dependency injection relies on
// (`emitDecoratorMetadata`). Bundling from src/ boots to a runtime crash:
//   "CannotDetermineTypeError: Cannot determine a type for the Otp.mobile field".
// tsc (via `nest build`) DOES emit that metadata into dist/*.js as ordinary
// runtime Reflect calls, which esbuild then preserves untouched. So the rule is:
// everything with decorators must be compiled by tsc first; this file (no
// decorators) is the only thing esbuild transpiles.
//
// vercel.json runs `nest build` before this function is bundled, so dist/ exists.
// This file is never run or type-checked locally (main.ts is the local entry and
// tsconfig.build.json excludes api/), so importing build output here is safe.
import { AppModule } from '../dist/app.module';
import { configureApp } from '../dist/bootstrap';

/**
 * Vercel serverless entry point for the NestJS API.
 *
 * Boots the Nest app ONCE and reuses it while the instance stays warm; only a
 * cold start pays the boot cost. Caches the boot PROMISE, not the resolved app,
 * so two requests hitting a cold instance share one boot instead of racing two
 * (which would open two apps and two Mongo connections). app.init() wires the DI
 * container and routes without opening a port — the one thing that differs from
 * main.ts; everything else comes from configureApp() so the two entries match.
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
