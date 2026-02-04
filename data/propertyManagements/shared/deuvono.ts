import { z } from "zod";
import { fetchJson } from "~/lib/http";

export const extractDeuvonoUrls = async (provider: "vonovia" | "deuwo") => {
  const apiUrl =
    provider === "vonovia"
      ? "https://www.vonovia.de/api/real-estate/list"
      : "https://www.deutsche-wohnen.com/api/deuwo-real-estate/list";
  const url = new URL(apiUrl);
  url.searchParams.set("limit", "1000");
  url.searchParams.set("rentType", "miete");
  url.searchParams.set("city", "Berlin");
  url.searchParams.set("locationDisplay", "Berlin");
  url.searchParams.set("dataSet", provider);

  const data = await fetchJson(url.toString());

  const parsed = z
    .object({
      results: z.array(
        z.object({
          slug: z.string(),
        }),
      ),
    })
    .safeParse(data);

  if (!parsed.success) {
    throw new Error(`Failed to parse data: ${parsed.error}`);
  }
  return parsed.data.results.map((item) =>
    provider === "vonovia"
      ? `https://www.vonovia.de/zuhause-finden/immobilien/${item.slug}`
      : `https://www.deutsche-wohnen.com/mieten/mietangebote/${item.slug}`,
  );
};
