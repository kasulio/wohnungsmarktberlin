import { z } from "zod";

import { insertAddressSchema } from "./address";
import type { propertyManagements } from "./propertyManagements";

export const mailingListSignUpSchema = z.object({
  email: z.email("Die E-Mail Adresse ist nicht gültig"),
  district: z.array(z.string()),
  rooms: z.int(),
  price: z.int(),
});

export const flatSchema = z.object({
  id: z.string(),
  title: z.string(),
  coldRentPrice: z.number().nullable().optional(),
  warmRentPrice: z.number().nullable().optional(),
  roomCount: z.number().nullable().optional(),
  usableArea: z.number().nullable().optional(),
  addressText: z.string(),
  address: insertAddressSchema.optional(),
  floor: z.number().nullable().optional(),
  imageUrl: z.string().optional().nullable(),
  url: z.string(),
});

export const scrapedFlatSchema = flatSchema.omit({ id: true });

export type Flat = z.infer<typeof flatSchema>;
export type ScrapedFlat = z.infer<typeof scrapedFlatSchema>;

/** Fields provider-specific ignore hooks may use (title handled globally in flat-utils). */
export type FlatForProviderIgnoreCheck = Pick<
  FlatForIgnoreCheck,
  "coldRentPrice" | "warmRentPrice" | "roomCount"
>;

/** Minimal fields for ignore rules (scraped flat + `propertyManagementId`, or DB row). */
export type FlatForIgnoreCheck = {
  title: string;
  propertyManagementId?: keyof typeof propertyManagements | null;
  coldRentPrice?: number | null;
  warmRentPrice?: number | null;
  roomCount?: number | null;
};

const propertyManagementSchema = z.object({
  slug: z.string(),
  name: z.string(),
  website: z.string().optional(),
});

export type PropertyManagement = z.infer<typeof propertyManagementSchema> & {
  extractUrls: () => Promise<string[]>;
  extractDataFromHtml: (html: string, href: string) => ScrapedFlat;
  shouldIgnoreListing?: (flat: FlatForProviderIgnoreCheck) => boolean;
};
