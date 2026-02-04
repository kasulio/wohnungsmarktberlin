import { createCaller } from "../trpc/routers";
import { updateMapPreview } from "../updateMapPreview";

let previousMapPreviewHash: string | null = null;

export default defineTask({
  meta: {
    name: "clean-caches",
    description: "Clean the caches",
  },
  run: async () => {
    const caller = createCaller({
      user: "admin",
    });

    const mapPreviewHash = await caller.flat.getMapPreviewHash();

    if (previousMapPreviewHash === null) {
      previousMapPreviewHash = mapPreviewHash;
    }

    if (
      mapPreviewHash !== previousMapPreviewHash &&
      process.env.NODE_ENV !== "development"
    ) {
      console.log(`[task:clean-caches] regenerating map preview`);
      await updateMapPreview();
    }

    return { result: true };
  },
});
