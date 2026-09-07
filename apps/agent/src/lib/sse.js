/**
 * Server-sent events — the transport for watching a run work.
 *
 * SSE rather than WebSockets because the traffic is one-directional and it
 * survives proxies and reconnects without a library on either end.
 *
 * STRUCTURE ONLY.
 */

/** Write the SSE headers and return a writer bound to this response. */
export function openStream(_res) {
  // TODO: Content-Type text/event-stream, Cache-Control no-cache,
  // Connection keep-alive, X-Accel-Buffering no (nginx buffers otherwise).
  // Return { send(event, data), close() }.
}

/** Keep-alive comment. Without one, idle streams get closed at ~30-60s. */
export function heartbeat(_stream, _intervalMs = 15_000) {
  // TODO — return the clearInterval handle so the caller can stop it.
}
