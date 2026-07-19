import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

/**
 * Single entry that serves BOTH environments, from the SAME tsc-compiled output
 * (dist/main.js) — which is what makes it work on Vercel.
 *
 * Vercel bundles functions with esbuild, and esbuild drops the decorator
 * metadata NestJS/Mongoose DI needs. The trick: Vercel searches the output
 * directory for a server entrypoint (main.js), and `nest build` (tsc) produces
 * exactly dist/main.js WITH the metadata baked in as runtime Reflect calls. So
 * we point Vercel's outputDirectory at dist and let it use this compiled file —
 * no esbuild re-compilation of decorated code.
 *
 * - On Vercel: this module is IMPORTED, and Vercel calls the default export as
 *   the per-request handler. The Nest app is booted once and cached (warm reuse);
 *   caching the promise makes concurrent cold requests share one boot.
 * - Locally / any Node host: run directly (`node dist/main`) → require.main is
 *   this module → start a real listening server.
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

// Vercel serverless entry: default export is the request handler.
export default async function handler(req: Request, res: Response) {
  if (!cached) cached = createServer();
  const server = await cached;
  server(req, res);
}

// Local / self-hosted: only when this file is run directly.
if (require.main === module) {
  createServer()
    .then((app) => {
      const port = process.env.PORT ?? 3000;
      app.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`🚀 API running on http://localhost:${port}/api`);
      });
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to start server', err);
      process.exit(1);
    });
}
