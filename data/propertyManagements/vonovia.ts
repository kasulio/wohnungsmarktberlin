import type { PropertyManagement } from "../schemas";
import {
  extractDeuvonoUrls,
  extractDeuvonoDataFromHtml,
  shouldIgnoreDeuvonoListing,
} from "./shared/deuvono";
import { propertyManagementConfigs } from "./configs";

export const vonovia = {
  ...propertyManagementConfigs.vonovia,
  extractUrls: () => extractDeuvonoUrls("vonovia"),
  extractDataFromHtml: extractDeuvonoDataFromHtml,
  shouldIgnoreListing: shouldIgnoreDeuvonoListing,
} as const satisfies PropertyManagement;
