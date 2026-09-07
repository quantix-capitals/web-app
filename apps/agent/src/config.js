/**
 * Every environment variable this service reads, in one place, checked at boot.
 *
 * A service that discovers a missing key halfway through a scan has already
 * written a half-finished run to the database. Fail at startup instead.
 */

export const config = {
  port: Number(process.env.PORT ?? 8787),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  marketDataApiKey: process.env.MARKET_DATA_API_KEY ?? "",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean),
};

/** Throw unless everything needed to serve a request is present. */
export function assertConfig() {
  // TODO: list the required keys and throw with all the missing ones at once —
  // one restart per missing variable is a bad way to spend a morning.
}
