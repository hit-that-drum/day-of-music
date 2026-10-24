// _shared.ts — request parsing both /api/music routes share. (Not a route:
// only route.ts files are.)

import { z } from "zod";

/** The storefront country param: a 2-letter code, US when omitted. */
export const countryParam = z
  .string()
  .regex(/^[a-zA-Z]{2}$/, "country must be a 2-letter code")
  .default("US");

/** The 400 for query params that failed their schema. */
export function badRequest(message: string, error: z.ZodError): Response {
  return Response.json(
    { error: message, issues: error.flatten().fieldErrors },
    { status: 400 },
  );
}
