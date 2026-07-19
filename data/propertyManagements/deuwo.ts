import type { PropertyManagement } from "../schemas";
import {
  extractDeuvonoUrls,
  extractDeuvonoDataFromHtml,
  shouldIgnoreDeuvonoListing,
} from "./shared/deuvono";
import { propertyManagementConfigs } from "./configs";

export const deuwo = {
  ...propertyManagementConfigs.deuwo,
  extractUrls: () => extractDeuvonoUrls("deuwo"),
  extractDataFromHtml: extractDeuvonoDataFromHtml,
  shouldIgnoreListing: shouldIgnoreDeuvonoListing,
} as const satisfies PropertyManagement;
