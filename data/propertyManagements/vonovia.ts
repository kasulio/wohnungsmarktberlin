import {
  scrapedFlatSchema,
  type PropertyManagement,
  type ScrapedFlat,
} from "../schemas";
import { deuwo } from "./deuwo";
import { extractDeuvonoUrls } from "./shared/deuvono";

export const vonovia = {
  slug: "vonovia",
  name: "Vonovia",
  website: "https://www.vonovia.de",
  extractUrls: () => extractDeuvonoUrls("vonovia"),
  extractDataFromHtml: deuwo.extractDataFromHtml,
} as const satisfies PropertyManagement;
