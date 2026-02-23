import type { PropertyManagement } from "../schemas";
import {
  extractDeuvonoUrls,
  extractDeuvonoDataFromHtml,
} from "./shared/deuvono";
import { propertyManagementConfigs } from "./configs";

export const vonovia = {
  ...propertyManagementConfigs.vonovia,
  extractUrls: () => extractDeuvonoUrls("vonovia"),
  extractDataFromHtml: extractDeuvonoDataFromHtml,
} as const satisfies PropertyManagement;
