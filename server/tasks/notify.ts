import { runNotifySweep } from "~/server/lib/notify-sweep";

export default defineTask({
  meta: {
    name: "notify",
    description: "Notify subscribers (log/telegram/email) of newly-published flats",
  },
  run: async () => {
    const stats = await runNotifySweep();
    return { result: { success: true, stats } };
  },
});
