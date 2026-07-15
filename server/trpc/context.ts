import { type inferAsyncReturnType } from "@trpc/server";
import { getRequestHeader, getRequestIP, type H3Event } from "h3";

import { auth } from "~/lib/auth";

/**
 * Client IP for rate limits. Traefik appends the connecting peer to
 * X-Forwarded-For — take the last hop so a client-spoofed leftmost value
 * cannot bypass limits. Socket IP if no XFF (direct / local).
 */
function clientIp(e: H3Event): string {
  const xff = getRequestHeader(e, "x-forwarded-for");
  if (xff) {
    const hops = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const last = hops.at(-1);
    if (last) return last;
  }
  return getRequestIP(e) ?? "unknown";
}

/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/context
 */
export const createContext = async (e: H3Event) => {
  const ip = clientIp(e);
  const session = await auth.api.getSession({ headers: e.headers });
  const id = session?.user?.id;
  if (id) return { user: id, ip };
  return { ip };
};

export type Context = inferAsyncReturnType<typeof createContext>;
