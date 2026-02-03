import { db } from "~/db/db";
import { and, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { flat as flatTable, address as addressTable } from "~/db/schema";
import { getAddressInformation } from "~/lib/photon";

export default defineTask({
  meta: {
    name: "address-improvement",
    description: "Improve the addresses of the flats",
  },
  run: async () => {
    return { result: await updateAdresses() };
  },
});

export async function updateAdresses() {
  const flats = await db.query.flat.findMany({
    where: and(
      isNull(flatTable.addressId),
      isNotNull(flatTable.addressText),
      eq(flatTable.addressImprovement, "pending"),
    ),
    limit: 10,
    orderBy: [sql`random()`],
  });

  if (flats.length === 0) return;

  console.log(`[task] ${flats.length} addresses to improve`);
  for (const flat of flats) {
    const addressInformation = await getAddressInformation(flat.addressText);
    if (addressInformation) {
      const id = addressInformation.address.osmId.toString();
      await db
        .insert(addressTable)
        .values({
          id: id,
          street: addressInformation.address.street,
          city: addressInformation.address.city,
          streetNumber: addressInformation.address.housenumber,
          postalCode: addressInformation.address.postcode,
          longitude: addressInformation.coordinates.lng,
          latitude: addressInformation.coordinates.lat,
        })
        .onConflictDoNothing()
        .returning();

      await db
        .update(flatTable)
        .set({ addressId: id, addressImprovement: "success" })
        .where(eq(flatTable.id, flat.id));
    } else {
      console.error(`[task] No address found for ${flat.addressText}`);

      await db
        .update(flatTable)
        .set({ addressImprovement: "failed" })
        .where(eq(flatTable.id, flat.id));
    }

    await Bun.sleep(2000 + Math.random() * 5000);
  }
}

if (import.meta.main) {
  await updateAdresses();
}
