import { timingSafeEqual } from "node:crypto";

/** Bearer-token check for /api/ingestion/run. Fails closed when no secret is configured. */
export function isAuthorizedWorkerRequest(authorization: string | null | undefined, secret: string | undefined): boolean {
  if (!secret) return false;
  const match = /^Bearer (.+)$/.exec(authorization ?? "");
  if (!match) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
