import { type inferAsyncReturnType } from "@trpc/server";
import { type H3Event } from "h3";

import { auth } from "~/lib/auth";

/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/context
 */
export const createContext = async (e: H3Event) => {
  const session = await auth.api.getSession({ headers: e.headers });
  const id = session?.user?.id;
  if (id) return { user: id };
  return {};
};

export type Context = inferAsyncReturnType<typeof createContext>;
