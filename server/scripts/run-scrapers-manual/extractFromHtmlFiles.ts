import { readdir } from "node:fs/promises";
import { propertyManagements } from "~/data/propertyManagements";
import { processWithQueue } from "~/lib/utils";
import { parseCliArgs } from "./parseCliArgs";

const { provider, limit } = parseCliArgs();

const allFiles = await readdir("data/html");

const files = allFiles
  .filter((file) => {
    const slug = file.split("-")[0];
    return provider ? slug === provider : true;
  })
  .slice(0, limit);

await processWithQueue(
  files,
  async (file) => {
    const filePath = "data/html/" + file;
    const html = await Bun.file(filePath).text();

    const slug = file.split("-")[0];
    const pm = Object.values(propertyManagements).find((pm) => pm.slug === slug);
    if (!pm) {
      throw new Error(`Property management "${slug}" not found`);
    }

    console.log("Extracting data from", file);
    try {
      const flat = pm.extractDataFromHtml(html, `file://${filePath}`);
      console.log(flat);
    } catch (error) {
      console.error("Error extracting data from", file, error);
    }
  },
  {
    concurrency: 1,
    wait: 0,
  }
);
