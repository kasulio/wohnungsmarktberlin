import type { PropertyManagement } from "../schemas";
import {
  extractDeuvonoUrls,
  extractDeuvonoDataFromHtml,
} from "./shared/deuvono";
import { propertyManagementConfigs } from "./configs";

export const deuwo = {
  ...propertyManagementConfigs.deuwo,
  extractUrls: () => extractDeuvonoUrls("deuwo"),
  extractDataFromHtml: extractDeuvonoDataFromHtml,
} as const satisfies PropertyManagement;
