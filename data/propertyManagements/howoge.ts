import type { Browser } from "puppeteer-core";
import type { PropertyManagement } from "../propertyManagementList";
import { fetchIBWFlats, IBW_PROVIDERS } from "../shared/inberlinwohnen";

export const howoge: PropertyManagement = {
  slug: "howoge",
  name: "HOWOGE Wohnungsbaugesellschaft",
  website: "https://www.howoge.de/",
  getFlats: async () => {
    return await fetchIBWFlats(IBW_PROVIDERS.howoge, "HOWOGE");
  },
};
