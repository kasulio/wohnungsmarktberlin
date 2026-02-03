import { z } from "zod";

import type { Browser } from "puppeteer-core";
import { insertAddressSchema } from "./address";
import { tagsSchema } from "./tags";

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
  tags: tagsSchema,
  imageUrl: z.string().optional().nullable(),
  url: z.string(),
});

export type Flat = z.infer<typeof flatSchema>;

const propertyManagementSchema = z.object({
  slug: z.string(),
  name: z.string(),
  website: z.string().optional(),
});

export type PropertyManagement = z.infer<typeof propertyManagementSchema> & {
  extractUrls: () => Promise<string[]>;
  extractDataFromHtml: (html: string, href: string) => Flat;
};
