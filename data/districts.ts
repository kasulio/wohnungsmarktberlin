import { z } from "zod";
import { typedObjectKeys } from "~/utils/typeHelper";

/**
 * Berlin's 12 administrative Bezirke → PLZ.
 *
 * Source: Amt für Statistik Berlin-Brandenburg, Regionales Bezugssystem (RBS) Adressen
 * (WFS https://gdi.berlin.de/services/wfs/adressen_rbs), CC-BY-3.0.
 * Each PLZ is assigned to the Bezirk with the majority of RBS address points
 * (fetched 2026-07-15, 404105 addresses, 193 PLZ).
 * Border PLZs that span Bezirke use the majority assignment only.
 */
export const berlinDistricts = {
  mitte: {
    name: "Mitte",
    shortName: "Mitte",
    zipCodes: [
      "10115",
      "10117",
      "10119",
      "10178",
      "10179",
      "10551",
      "10553",
      "10555",
      "10557",
      "10559",
      "10785",
      "10787",
      "13347",
      "13349",
      "13351",
      "13353",
      "13355",
      "13357",
      "13359",
    ],
  },
  "friedrichshain-kreuzberg": {
    name: "Friedrichshain-Kreuzberg",
    shortName: "Fhain-Kreuzberg",
    zipCodes: [
      "10243",
      "10245",
      "10247",
      "10249",
      "10961",
      "10963",
      "10965",
      "10967",
      "10969",
      "10997",
      "10999",
    ],
  },
  pankow: {
    name: "Pankow",
    shortName: "Pankow",
    zipCodes: [
      "10405",
      "10407",
      "10409",
      "10435",
      "10437",
      "10439",
      "13086",
      "13088",
      "13089",
      "13125",
      "13127",
      "13129",
      "13156",
      "13158",
      "13159",
      "13187",
      "13189",
    ],
  },
  "charlottenburg-wilmersdorf": {
    name: "Charlottenburg-Wilmersdorf",
    shortName: "Charlottenburg",
    zipCodes: [
      "10585",
      "10587",
      "10589",
      "10623",
      "10625",
      "10627",
      "10629",
      "10707",
      "10709",
      "10711",
      "10713",
      "10715",
      "10717",
      "10719",
      "10789",
      "13627",
      "14050",
      "14052",
      "14053",
      "14055",
      "14057",
      "14059",
      "14193",
      "14197",
      "14199",
    ],
  },
  spandau: {
    name: "Spandau",
    shortName: "Spandau",
    zipCodes: [
      "13581",
      "13583",
      "13585",
      "13587",
      "13589",
      "13591",
      "13593",
      "13595",
      "13597",
      "13599",
      "13629",
      "14089",
    ],
  },
  "steglitz-zehlendorf": {
    name: "Steglitz-Zehlendorf",
    shortName: "Steglitz",
    zipCodes: [
      "12163",
      "12165",
      "12167",
      "12169",
      "12203",
      "12205",
      "12207",
      "12209",
      "12247",
      "12249",
      "14109",
      "14129",
      "14163",
      "14165",
      "14167",
      "14169",
      "14195",
    ],
  },
  "tempelhof-schoeneberg": {
    name: "Tempelhof-Schöneberg",
    shortName: "Tempelhof",
    zipCodes: [
      "10777",
      "10779",
      "10781",
      "10783",
      "10823",
      "10825",
      "10827",
      "10829",
      "12099",
      "12101",
      "12103",
      "12105",
      "12107",
      "12109",
      "12157",
      "12159",
      "12161",
      "12277",
      "12279",
      "12305",
      "12307",
      "12309",
    ],
  },
  neukoelln: {
    name: "Neukölln",
    shortName: "Neukölln",
    zipCodes: [
      "12043",
      "12045",
      "12047",
      "12049",
      "12051",
      "12053",
      "12055",
      "12057",
      "12059",
      "12347",
      "12349",
      "12351",
      "12353",
      "12355",
      "12357",
      "12359",
    ],
  },
  "treptow-koepenick": {
    name: "Treptow-Köpenick",
    shortName: "Treptow",
    zipCodes: [
      "12435",
      "12437",
      "12439",
      "12459",
      "12487",
      "12489",
      "12524",
      "12526",
      "12527",
      "12555",
      "12557",
      "12559",
      "12587",
      "12589",
      "15537",
      "15566",
      "15569",
    ],
  },
  "marzahn-hellersdorf": {
    name: "Marzahn-Hellersdorf",
    shortName: "Marzahn",
    zipCodes: [
      "12619",
      "12621",
      "12623",
      "12627",
      "12629",
      "12679",
      "12681",
      "12683",
      "12685",
      "12687",
      "12689",
    ],
  },
  lichtenberg: {
    name: "Lichtenberg",
    shortName: "Lichtenberg",
    zipCodes: [
      "10315",
      "10317",
      "10318",
      "10319",
      "10365",
      "10367",
      "10369",
      "13051",
      "13053",
      "13055",
      "13057",
      "13059",
    ],
  },
  reinickendorf: {
    name: "Reinickendorf",
    shortName: "Reinickendorf",
    zipCodes: [
      "13403",
      "13405",
      "13407",
      "13409",
      "13435",
      "13437",
      "13439",
      "13465",
      "13467",
      "13469",
      "13503",
      "13505",
      "13507",
      "13509",
    ],
  },
} as const;

/** Virtual Bezirk for flats whose PLZ is not mapped to any Berlin district. */
export const UNKNOWN_DISTRICT_ID = "unbekannt" as const;

export const unknownDistrict = {
  name: "Unbekannt",
  shortName: "Unbekannt",
} as const;

export const zipCodeToDistrict = Object.entries(berlinDistricts).reduce(
  (acc, [key, district]) => {
    district.zipCodes.forEach((zipCode) => {
      acc[zipCode] = { ...district, slug: key };
    });
    return acc;
  },
  {} as Record<
    string,
    (typeof berlinDistricts)[keyof typeof berlinDistricts] & { slug: string }
  >,
);

/** All PLZs assigned to a real Berlin Bezirk. */
export const allBerlinZipCodes = Object.keys(zipCodeToDistrict);

/** True when the PLZ maps to one of the 12 Bezirke. */
export function isMappedPostalCode(postalCode: string): boolean {
  return postalCode in zipCodeToDistrict;
}

const districts = typedObjectKeys(berlinDistricts);

export const districtIdSchema = z.enum(districts);
/** Real Bezirke plus the virtual "unbekannt" filter id. */
export const filterDistrictIdSchema = z.enum([
  ...districts,
  UNKNOWN_DISTRICT_ID,
]);
export const districtSchema = z.object({
  title: z.string(),
  zipCodes: z.array(z.string()),
});

export type DistrictId = z.infer<typeof districtIdSchema>;
export type FilterDistrictId = z.infer<typeof filterDistrictIdSchema>;
