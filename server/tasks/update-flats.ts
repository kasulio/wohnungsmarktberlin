import { createCaller } from "../trpc/routers";
import { berlinCoordinates } from "~/data/coordinates";
import { updateMapPreview } from "../updateMapPreview";

export default defineTask({
  meta: {
    name: "update-flats",
    description: "Improve the addresses of the flats",
  },
  run: async () => {
    const caller = createCaller({ user: "admin" });

    const previousPreviewHash = await caller.flat.getMapPreviewHash();

    const result = await caller.propertyManagement.update({ return: true });

    const previewHash = await caller.flat.getMapPreviewHash();

    if (previousPreviewHash !== previewHash) {
      // TODO: check if this is still necessary
      // this is just to make the bundler pull it in
      const nothing = berlinCoordinates;
      await updateMapPreview(previewHash);
    }
    return { result };
  },
});
