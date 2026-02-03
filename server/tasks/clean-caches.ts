import { cleanUpCaches } from "../image-cache";

export default defineTask({
  meta: {
    name: "clean-caches",
    description: "Clean the caches",
  },
  run: async () => {
    cleanUpCaches();
    return { result: true };
  },
});
