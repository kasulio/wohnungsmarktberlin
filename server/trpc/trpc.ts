/**
 * This is your entry point to setup the root configuration for tRPC on the server.
 * - `initTRPC` should only be used once per app.
 * - We export only the functionality that we use so we can enforce which base procedures should be used
 *
 * Learn how to create protected base procedures and other things below:
 * @see https://trpc.io/docs/v10/router
 * @see https://trpc.io/docs/v10/procedures
 */
import { TRPCError, initTRPC } from "@trpc/server";
import { createLogger } from "~/lib/logger";
import { type Context } from "~/server/trpc/context";

const log = createLogger("trpc");
const SLOW_PROCEDURE_MS = 1_500;

const t = initTRPC.context<Context>().create();

const timing = t.middleware(async ({ path, type, next }) => {
  const started = performance.now();
  const result = await next();
  const durationMs = Math.round(performance.now() - started);
  // Skip slow-call warning for interactive admin scrapes, which legitimately take seconds.
  if (durationMs >= SLOW_PROCEDURE_MS && path !== "propertyManagement.update") {
    log.warn("slow trpc procedure", {
      path,
      type,
      durationMs,
      ok: result.ok,
    });
  }
  return result;
});

const isAuthed = t.middleware(({ ctx, next }) => {
  if (ctx.user) return next({ ctx });
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "You must be logged in to do that",
  });
});

const baseProcedure = t.procedure.use(timing);

export const createCallerFactory = t.createCallerFactory;
export const protectedProcedure = baseProcedure.use(isAuthed);
export const publicProcedure = baseProcedure;
export const router = t.router;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;
