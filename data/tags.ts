import { type SQL, sql, or } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { z } from "zod";
import { typedObjectKeys } from "~/utils/typeHelper";

export const tags = {
  new: "neu",
  wbs: "WBS",
  altbau: "Altbau",
  neubau: "Neubau",
  erstbezug: "Erstbezug",
  dachgeschoss: "Dachgeschoss",
  familie: "Familie",
};

// this is necessary for the type to be inferred correctly
const keys = typedObjectKeys(tags);

export const tagsSchema = z.array(z.enum(keys));
export type Tags = z.infer<typeof tagsSchema>;

export const titleToTagsMap = {
  altbau: ["altbau"],
  neubau: ["neubau"],
  wbs: ["wbs"],
  wohnberechtigungsschein: ["wbs"],
  erstbezug: ["erstbezug"],
  dachgeschoss: ["dachgeschoss"],
  familie: ["familie"],
} as const;

export const tagKeys = typedObjectKeys(tags);

type TitleDerivedTag = Exclude<Tags[number], "new">;

export const tagTitleKeywords = Object.entries(titleToTagsMap).reduce(
  (acc, [keyword, tagList]) => {
    for (const tag of tagList) {
      const list = (acc[tag] ??= []);
      if (!list.includes(keyword)) {
        list.push(keyword);
      }
    }
    return acc;
  },
  {} as Partial<Record<TitleDerivedTag, string[]>>,
);

export const getApartmentTags = (
  title: string,
  customTagsMap?: Record<string, Tags>,
): Tags => {
  const map = customTagsMap ?? titleToTagsMap;
  const seen = new Set<Tags[number]>();
  const lowerTitle = title.toLowerCase();

  for (const key of typedObjectKeys(map)) {
    if (lowerTitle.includes(key)) {
      for (const tag of map[key]) {
        seen.add(tag);
      }
    }
  }

  return [...seen] as Tags;
};

export const getDisplayTags = (title: string, isNew: boolean): Tags => {
  const derived = getApartmentTags(title);
  return isNew ? [...derived, "new"] : derived;
};

/** SQL predicate: title matches any of the given tags (OR). Excludes "new". */
export function titleMatchesAnyTagFilter(
  titleColumn: AnyColumn,
  filterTags: Tags,
): SQL {
  const conditions: SQL[] = [];

  for (const tag of filterTags) {
    if (tag === "new") continue;
    const keywords = tagTitleKeywords[tag];
    if (!keywords) continue;
    for (const keyword of keywords) {
      conditions.push(
        sql`lower(${titleColumn}) like ${`%${keyword.toLowerCase()}%`}`,
      );
    }
  }

  if (conditions.length === 0) return sql`FALSE`;
  return or(...conditions)!;
}
