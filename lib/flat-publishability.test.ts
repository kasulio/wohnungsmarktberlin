import { describe, expect, test } from "bun:test";
import { isPublishable, type PublishableFlat } from "./flat-publishability";

describe("isPublishable", () => {
  const base: PublishableFlat = {
    deleted: null,
    addressId: "addr-1",
    ignored: false,
  };

  const cases: { name: string; flat: PublishableFlat; want: boolean }[] = [
    { name: "valid", flat: base, want: true },
    { name: "deleted", flat: { ...base, deleted: new Date() }, want: false },
    { name: "no address", flat: { ...base, addressId: null }, want: false },
    { name: "ignored", flat: { ...base, ignored: true }, want: false },
    {
      name: "deleted + ignored + no address",
      flat: { deleted: new Date(), addressId: null, ignored: true },
      want: false,
    },
  ];

  for (const { name, flat, want } of cases) {
    test(name, () => {
      expect(isPublishable(flat)).toBe(want);
    });
  }
});
