import type { Browser } from "puppeteer-core";
import type { PropertyManagement } from "../propertyManagementList";
import { fetchWRKFlats } from "../shared/wohnraumkarte";

export const vonovia: PropertyManagement = {
  slug: "vonovia",
  name: "Vonovia SE",
  website: "https://www.vonovia.de/",
  getFlats: async (browser: Browser) => {
    // Vonovia uses the Wohnraumkarte API
    // Browser parameter is not needed for API-based scraping
    return await fetchWRKFlats("vonovia", "Vonovia SE");
  },
};
