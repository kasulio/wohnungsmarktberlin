import { db } from "~/server/db/client";
import { signups } from "~/server/db/schema";

export const getMailList = async () => {
  const allSignups = await db.select().from(signups);
  console.log(allSignups);
  return allSignups;
};
