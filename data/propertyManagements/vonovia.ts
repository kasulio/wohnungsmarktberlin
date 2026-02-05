import type { PropertyManagement } from "../schemas";
import {
  extractDeuvonoUrls,
  extractDeuvonoDataFromHtml,
} from "./shared/deuvono";

export const vonovia = {
  slug: "vonovia",
  name: "Vonovia",
  website: "https://www.vonovia.de",
  extractUrls: () => extractDeuvonoUrls("vonovia"),
  extractDataFromHtml: extractDeuvonoDataFromHtml,
} as const satisfies PropertyManagement;
