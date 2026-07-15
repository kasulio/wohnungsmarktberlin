export const propertyManagementConfigs = {
  berlinovo: {
    slug: "berlinovo",
    name: "berlinovo",
    website: "https://www.berlinovo.de",
  },
  gewobag: {
    slug: "gewobag",
    name: "Gewobag",
    website: "https://www.gewobag.de/",
  },
  deuwo: {
    slug: "deuwo",
    name: "Deutsche Wohnen",
    website: "https://www.deutsche-wohnen.com",
  },
  vonovia: {
    slug: "vonovia",
    name: "Vonovia",
    website: "https://www.vonovia.de",
  },
  stadtundland: {
    slug: "stadtundland",
    name: "Stadt und Land",
    website: "https://www.stadtundland.de/",
  },
  degewo: {
    slug: "degewo",
    name: "degewo",
    website: "https://www.degewo.de/",
  },
  howoge: {
    slug: "howoge",
    name: "HOWOGE",
    website: "https://www.howoge.de",
  },
} as const;

export type PropertyManagementId = keyof typeof propertyManagementConfigs;
