import type { Browser } from "puppeteer-core";
import type { PropertyManagement } from "../propertyManagementList";
import { fetchIBWFlats, IBW_PROVIDERS } from "../shared/inberlinwohnen";

export const wbm: PropertyManagement = {
  slug: "wbm",
  name: "WBM Wohnungsbaugesellschaft Berlin-Mitte",
  website: "https://www.wbm.de/",
  getFlats: async (browser: Browser) => {
    // WBM uses the InBerlinWohnen platform
    // Browser parameter is not needed for API-based scraping
    return await fetchIBWFlats(IBW_PROVIDERS.wbm, "WBM");
  },
};
