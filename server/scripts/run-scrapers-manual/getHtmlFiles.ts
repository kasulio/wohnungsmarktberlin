import { propertyManagements } from "~/data/propertyManagements";
import { fetchHtml } from "~/lib/http";
import { parseCliArgs } from "./parseCliArgs";

const { provider } = parseCliArgs();

function getFileName(url: string, slug: string) {
  const urlPath = new URL(url).pathname.replaceAll("/", "-");
  return (slug + urlPath).replace(".html", "");
}

const providers = provider
  ? Object.values(propertyManagements).filter((pm) => pm.slug === provider)
  : Object.values(propertyManagements);

for (const pm of providers) {
  const urls = await pm.extractUrls();

  for (const url of urls) {
    const fileName = getFileName(url, pm.slug);
    if (await Bun.file(`data/html/${fileName}.html`).exists()) {
      console.log("Skipping", fileName, "because it already exists");
      continue;
    }

    const html = await fetchHtml(url);
    console.log("Writing HTML to file", fileName);
    await Bun.write(`data/html/${fileName}.html`, html);

    await Bun.sleep(1000 + Math.random() * 1000);
  }
}
