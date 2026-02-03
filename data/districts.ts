import { z } from "zod";
import { typedObjectKeys } from "@/utils/typeHelper";

export const berlinDistricts = {
  charlottenburg: {
    name: "Charlottenburg",
    zipCodes: [
      "10627",
      "14057",
      "10625",
      "10589",
      "10587",
      "10585",
      "10629",
      "14059",
      "10623",
      "10623",
    ],
  },
  maerkischesviertel: {
    name: "Märkisches Viertel",
    zipCodes: ["13439", "13435"],
  },
  rosenthal: {
    name: "Rosenthal",
    zipCodes: ["13158"],
  },
  pankow: {
    name: "Pankow",
    zipCodes: ["13189", "13187"],
  },
  britz: {
    name: "Britz",
    zipCodes: ["12347", "12359"],
  },
  koepenick: {
    name: "Köpenick",
    zipCodes: ["12559", "12559"],
  },
  wannsee: {
    name: "Wannsee",
    zipCodes: ["14109"],
  },
  westend: {
    name: "Westend",
    zipCodes: ["14053", "14052", "14055", "14050"],
  },
  lichterfelde: {
    name: "Lichterfelde",
    zipCodes: ["12209"],
  },
  wedding: {
    name: "Wedding",
    zipCodes: ["13351", "13353", "13347", "13405", "13349", "13355"],
  },
  altglienicke: {
    name: "Altglienicke",
    zipCodes: ["12524"],
  },
  tegel: {
    name: "Tegel",
    zipCodes: ["13503", "13507", "13505"],
  },
  moabit: {
    name: "Moabit",
    zipCodes: ["10559", "10557", "10555", "10551", "10553"],
  },
  mitte: {
    name: "Mitte",
    zipCodes: ["10179", "10115", "10178", "10119", "10117"],
  },
  berlin: {
    name: "Berlin",
    zipCodes: [
      "12487",
      "12305",
      "12277",
      "10319",
      "12309",
      "10827",
      "12679",
      "12307",
      "12687",
      "12685",
      "10825",
      "12305",
      "12619",
      "12629",
      "12685",
      "12679",
      "12557",
      "12681",
      "12279",
      "12689",
    ],
  },
  nikolassee: {
    name: "Nikolassee",
    zipCodes: ["14129"],
  },
  tiergarten: {
    name: "Tiergarten",
    zipCodes: ["10787", "10785"],
  },
  tempelhof: {
    name: "Tempelhof",
    zipCodes: ["12101", "12099", "12103"],
  },
  prenzlauerberg: {
    name: "Prenzlauer Berg",
    zipCodes: ["10437", "10405", "10409", "10435", "10407", "10439"],
  },
  buckow: {
    name: "Buckow",
    zipCodes: ["12351", "12349"],
  },
  friedrichshain: {
    name: "Friedrichshain",
    zipCodes: ["10247", "10243", "10249", "10245"],
  },
  schmoeckwitz: {
    name: "Schmöckwitz",
    zipCodes: ["12527"],
  },
  hakenfelde: {
    name: "Hakenfelde",
    zipCodes: ["13587"],
  },
  lichtenberg: {
    name: "Lichtenberg",
    zipCodes: ["10367", "10369", "10365"],
  },
  steglitz: {
    name: "Steglitz",
    zipCodes: ["12169", "12163", "12167", "12165"],
  },
  friedenau: {
    name: "Friedenau",
    zipCodes: ["12159", "12161"],
  },
  kreuzberg: {
    name: "Kreuzberg",
    zipCodes: [
      "10963",
      "10997",
      "10965",
      "10961",
      "10969",
      "10999",
      "12047",
      "10967",
    ],
  },
  gropiusstadt: {
    name: "Gropiusstadt",
    zipCodes: ["12353"],
  },
  alttreptow: {
    name: "Alt Treptow",
    zipCodes: ["12435"],
  },
  biesdorf: {
    name: "Biesdorf",
    zipCodes: ["12683"],
  },
  reinickendorf: {
    name: "Reinickendorf",
    zipCodes: ["13403", "13509", "13437"],
  },
  wilmersdorf: {
    name: "Wilmersdorf",
    zipCodes: ["10719", "10713", "10707", "10777", "10709", "10717", "14197"],
  },
  lankwitz: {
    name: "Lankwitz",
    zipCodes: ["12249", "12247"],
  },
  schoeneberg: {
    name: "Schöneberg",
    zipCodes: ["10829", "10789", "10781", "10783", "10779", "12157"],
  },
  bohnsdorf: {
    name: "Bohnsdorf",
    zipCodes: ["12526"],
  },
  mariendorf: {
    name: "Mariendorf",
    zipCodes: ["12107", "12109", "12105", "12107"],
  },
  gesundbrunnen: {
    name: "Gesundbrunnen",
    zipCodes: ["13357", "13359"],
  },
  neukoelln: {
    name: "Neukölln",
    zipCodes: [
      "12043",
      "12059",
      "12051",
      "12053",
      "12059",
      "12049",
      "12045",
      "12057",
      "12055",
    ],
  },
  niederschoeneweide: {
    name: "Niederschöneweide",
    zipCodes: ["12439"],
  },
  lichtenfelde: {
    name: "Lichtenfelde",
    zipCodes: ["12203", "12207", "12205"],
  },
  wilhelmsdorf: {
    name: "Wilhelmsdorf",
    zipCodes: ["10715"],
  },
  wartenberg: {
    name: "Wartenberg",
    zipCodes: ["13059"],
  },
  falkenberg: {
    name: "Falkenberg",
    zipCodes: ["13057"],
  },
  niederschoenhausen: {
    name: "Niederschönhausen",
    zipCodes: ["13156"],
  },
  rudow: {
    name: "Rudow",
    zipCodes: ["12355", "12357"],
  },
  mahlsdorf: {
    name: "Mahlsdorf",
    zipCodes: ["12623", "12623"],
  },
  spandau: {
    name: "Spandau",
    zipCodes: ["13585", "13597", "13581", "13583"],
  },
  haselhorst: {
    name: "Haselhorst",
    zipCodes: ["13599"],
  },
  luebars: {
    name: "Lübars",
    zipCodes: ["13469"],
  },
  halensee: {
    name: "Halensee",
    zipCodes: ["10711"],
  },
  west: {
    name: "West",
    zipCodes: ["13409", "13407", "10823"],
  },
  weissensee: {
    name: "Weißensee",
    zipCodes: ["13086", "13088"],
  },
  gatow: {
    name: "Gatow",
    zipCodes: ["14089"],
  },
  franzoesischbuchholz: {
    name: "Französisch Buchholz",
    zipCodes: ["13127"],
  },
  blankenfelde: {
    name: "Blankenfelde",
    zipCodes: ["13159"],
  },
  zehlendorf: {
    name: "Zehlendorf",
    zipCodes: ["14165", "14167", "14163", "14169"],
  },
  oberschoeneweide: {
    name: "Oberschöneweide",
    zipCodes: ["12459"],
  },
  wilhelmstadt: {
    name: "Wilhelmstadt",
    zipCodes: ["13593", "13595"],
  },
  falkenhagenerfeld: {
    name: "Falkenhagener Feld",
    zipCodes: ["13589"],
  },
  schmargendorf: {
    name: "Schmargendorf",
    zipCodes: ["14199"],
  },
  althohenschoenhausen: {
    name: "Alt-Hohenschönhausen",
    zipCodes: ["13055", "13053"],
  },
  friedrichsfelde: {
    name: "Friedrichsfelde",
    zipCodes: ["10315"],
  },
  heinelsdorf: {
    name: "Heinelsdorf",
    zipCodes: ["13089"],
  },
  rummelsburg: {
    name: "Rummelsburg",
    zipCodes: ["10317"],
  },
  schoeneichebeiberlin: {
    name: "Schöneiche bei Berlin",
    zipCodes: ["15566"],
  },
  staaken: {
    name: "Staaken",
    zipCodes: ["13591"],
  },
  siemensstadt: {
    name: "Siemensstadt",
    zipCodes: ["13629"],
  },
  karlshorst: {
    name: "Karlshorst",
    zipCodes: ["10318"],
  },
  frohnau: {
    name: "Frohnau",
    zipCodes: ["13465"],
  },
  teltowkanaliii: {
    name: "Teltowkanal III",
    zipCodes: ["12489"],
  },
  hellersdorf: {
    name: "Hellersdorf",
    zipCodes: ["12627"],
  },
  dahlem: {
    name: "Dahlem",
    zipCodes: ["14195"],
  },
  hermsdorf: {
    name: "Hermsdorf",
    zipCodes: ["13467"],
  },
  koepenik: {
    name: "Köpenik",
    zipCodes: ["12555"],
  },
  buch: {
    name: "Buch",
    zipCodes: ["13125"],
  },
  grunewald: {
    name: "Grunewald",
    zipCodes: ["14193"],
  },
  baumschulenweg: {
    name: "Baumschulenweg",
    zipCodes: ["12437"],
  },
  wiesengrund: {
    name: "Wiesengrund",
    zipCodes: ["12587"],
  },
  rahnsdorf: {
    name: "Rahnsdorf",
    zipCodes: ["12589"],
  },

  blankenburg: {
    name: "Blankenburg",
    zipCodes: ["13129"],
  },
  kaulsdorf: {
    name: "Kaulsdorf",
    zipCodes: ["12621"],
  },
  charlottenburgnord: {
    name: "Charlottenburg-Nord",
    zipCodes: ["13627"],
  },
  neuschoenhausen: {
    name: "Neu-Schönhausen",
    zipCodes: ["13051"],
  },
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

// this is necessary for the type to be inferred correctly
const districts = typedObjectKeys(berlinDistricts);

export const districtIdSchema = z.enum(districts);
export const districtSchema = z.object({
  title: z.string(),
  zipCodes: z.array(z.string()),
});

export type DistrictId = z.infer<typeof districtIdSchema>;
