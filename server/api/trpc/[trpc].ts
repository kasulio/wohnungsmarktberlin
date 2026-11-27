import { createNuxtApiHandler } from "trpc-nuxt";
import { createLogger } from "~/lib/logger";
import { sendOpsAlert } from "~/server/lib/ops-alerts";
import { appRouter } from "~/server/trpc/routers";
import { createContext } from "~/server/trpc/context";

const log = createLogger("trpc");

export default createNuxtApiHandler({
  router: appRouter,
  createContext,
  onError({ error, path, type }) {
    if (error.code === "INTERNAL_SERVER_ERROR") {
      log.error("trpc internal error", {
        path,
        type,
        code: error.code,
        error: error.cause ?? error,
      });
      void sendOpsAlert({
        key: `trpc-500:${path ?? "unknown"}`,
        title: `tRPC INTERNAL_SERVER_ERROR on ${path ?? "unknown"}`,
        details: error.message,
      });
      return;
    }

    log.warn("trpc error", {
      path,
      type,
      code: error.code,
      message: error.message,
    });
  },
});
