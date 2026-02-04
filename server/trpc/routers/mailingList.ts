import { sql } from "drizzle-orm";
import { publicProcedure, router } from "../trpc";
import { db } from "~/server/db/client";
import { mailingListSignUpSchema } from "~/data/schemas";
import { getMailList } from "~/data/mailingList";

export const mailingListRouter = router({
  signUp: publicProcedure
    .input(mailingListSignUpSchema)
    .mutation(async ({ input }) => {
      const res = await db.query.flat.findMany({
        limit: 2,
        orderBy: sql`RANDOM()`,
      });
      return res;
    }),
  get: publicProcedure.query(async () => {
    return await getMailList();
  }),
});
