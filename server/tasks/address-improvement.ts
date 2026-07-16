import { runAddressImprovement } from "~/server/lib/address-improvement";

export default defineTask({
  meta: {
    name: "address-improvement",
    description: "Improve the addresses of the flats",
  },
  run: async () => {
    const stats = await runAddressImprovement();
    return { result: { success: true, stats } };
  },
});
