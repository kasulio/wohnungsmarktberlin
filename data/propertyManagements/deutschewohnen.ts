import type { PropertyManagement } from "../propertyManagementList";
import { fetchWRKFlats } from "../shared/wohnraumkarte";

export const deutschewohnen: PropertyManagement = {
  slug: "deutschewohnen",
  name: "Deutsche Wohnen SE",
  website: "https://www.deutsche-wohnen.com/",
  getFlats: async () => {
    return await fetchWRKFlats("deuwo", "Deutsche Wohnen SE");
  },
};
