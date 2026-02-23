import { createCallerFactory, router } from "../trpc";
import { flatRouter } from "./flat";
import { propertyManagementRouter } from "./propertyManagement";
import { mailingListRouter } from "./mailingList";
import { statsRouter } from "./stats";

export const appRouter = router({
  flat: flatRouter,
  propertyManagement: propertyManagementRouter,
  mailingList: mailingListRouter,
  stats: statsRouter,
});

export const createCaller = createCallerFactory(appRouter);

// export type definition of API
export type AppRouter = typeof appRouter;
