import { expect, test } from "bun:test";
import { geocode, type PhotonFeature } from "./photon";

const street = (name: string, postcode: string): PhotonFeature => ({
  geometry: { coordinates: [13.3, 52.48] },
  properties: { name, postcode, city: "Berlin" },
});

const house = (
  streetName: string,
  housenumber: string,
  postcode: string,
): PhotonFeature => ({
  geometry: { coordinates: [13.31, 52.49] },
  properties: { street: streetName, housenumber, postcode, city: "Berlin" },
});

const fakeSearch = (answers: Record<string, PhotonFeature>) => {
  const queries: string[] = [];
  const search = async (q: string) => {
    queries.push(q);
    return answers[q];
  };
  return { queries, search };
};

test("finds a house number Photon knows", async () => {
  const { search } = fakeSearch({
    "Iranische Straße 4, 13347 Berlin": house("Iranische Straße", "4", "13347"),
  });

  expect(
    await geocode("id-1", "Iranische Straße 4, 13347 Berlin", search),
  ).toEqual({
    id: "id-1",
    street: "Iranische Straße",
    streetNumber: "4",
    postalCode: "13347",
    city: "Berlin",
    longitude: 13.31,
    latitude: 52.49,
  });
});

test("looks up 5 for 5B when Photon only knows the street, and keeps 5B", async () => {
  const { queries, search } = fakeSearch({
    "Hildegardstr. 5B, 10715 Berlin": street("Hildegardstraße", "10715"),
    "Hildegardstr. 5, 10715 Berlin": house("Hildegardstraße", "5", "10715"),
  });

  const found = await geocode("id-2", "Hildegardstr. 5B, 10715 Berlin", search);

  expect(queries).toEqual([
    "Hildegardstr. 5B, 10715 Berlin",
    "Hildegardstr. 5, 10715 Berlin",
  ]);
  expect(found).toMatchObject({
    street: "Hildegardstraße",
    streetNumber: "5B",
    longitude: 13.31,
  });
});

test("gives up when Photon only knows the street", async () => {
  const { search } = fakeSearch({
    "Jungfernheideweg 57, 13629 Berlin": street("Jungfernheideweg", "13629"),
  });

  expect(
    await geocode("id-3", "Jungfernheideweg 57, 13629 Berlin", search),
  ).toBeUndefined();
});
