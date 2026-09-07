/**
 * HTTP entry point. Its only job is to turn a request into a handler call — no
 * business logic lives here, so the routing stays readable as the surface grows.
 *
 * STRUCTURE ONLY: the handlers are stubs.
 */

import { createServer } from "node:http";
import { assertConfig, config } from "./config.js";
import { health } from "./routes/health.js";
import { createScan, getScan, streamScan } from "./routes/scans.js";

/**
 * Routes, most specific first. Each entry is [method, pattern, handler]; the
 * pattern is a URLPattern so `/scans/:id/events` needs no regex by hand.
 */
const ROUTES = [
  ["GET", "/health", health],
  ["POST", "/scans", createScan],
  ["GET", "/scans/:id/events", streamScan],
  ["GET", "/scans/:id", getScan],
];

function handle(_req, _res) {
  // TODO: CORS preflight against config.allowedOrigins, then match ROUTES and
  // dispatch. Unmatched -> 404 JSON. A thrown handler -> 500 JSON, logged with
  // the run id if there is one.
}

export function start() {
  assertConfig();
  const server = createServer(handle);
  server.listen(config.port, () => {
    console.log(`agent listening on :${config.port}`);
  });
  return server;
}

start();
