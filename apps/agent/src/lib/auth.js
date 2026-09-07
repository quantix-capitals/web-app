/**
 * Turning a request into a user id.
 *
 * The web app forwards the caller's Supabase access token as `Authorization:
 * Bearer <jwt>`. This service verifies it against the same project and pulls the
 * subject out. It never trusts a user id sent in a body or a query string — that
 * would let anyone run a scan as anyone.
 *
 * STRUCTURE ONLY.
 */

/** @returns {Promise<string>} the user id — throws 401 if the token is missing or bad. */
export async function requireUser(_req) {
  // TODO: read the bearer token, verify it (supabase.auth.getUser(token), or
  // verify the JWT against the project's JWKS), return user.id.
}
