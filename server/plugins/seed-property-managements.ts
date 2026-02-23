import { eq, notInArray } from "drizzle-orm";
import { propertyManagements } from "~/data/propertyManagements";
import { db } from "~/server/db/client";
import { propertyManagement } from "~/server/db/schema";

export default defineNitroPlugin(async () => {
  const active = Object.values(propertyManagements).map((pm) => ({
    slug: pm.slug,
    name: pm.name,
    website: pm.website,
    active: true as const,
  }));

  const activeSlugs = active.map((pm) => pm.slug);

  for (const pm of active) {
    await db
      .insert(propertyManagement)
      .values(pm)
      .onConflictDoUpdate({
        target: propertyManagement.slug,
        set: { name: pm.name, website: pm.website, active: true },
      });
  }

  if (activeSlugs.length > 0) {
    await db
      .update(propertyManagement)
      .set({ active: false })
      .where(notInArray(propertyManagement.slug, activeSlugs));
  }

  console.log(
    `[plugin:seed-property-managements] Synced ${active.length} property managements`,
  );
});
