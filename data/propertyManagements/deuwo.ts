import type { PropertyManagement } from "../schemas";
import {
  extractDeuvonoUrls,
  extractDeuvonoDataFromHtml,
} from "./shared/deuvono";

export const deuwo = {
  slug: "deuwo",
  name: "Deutsche Wohnen",
  website: "https://www.deutsche-wohnen.com",
  extractUrls: () => extractDeuvonoUrls("deuwo"),
  extractDataFromHtml: extractDeuvonoDataFromHtml,
} as const satisfies PropertyManagement;
