import { propertyManagements } from "~/data/propertyManagements";
import { type PropertyManagementId } from "~/data/propertyManagements/configs";
import { type PropertyManagement } from "~/data/schemas";
import { assertFlatShape } from "~/data/propertyManagements/shape-contract";
import { shouldIgnoreListing } from "~/lib/flat-utils";
import { fetchHtml } from "~/lib/http";

const CANARY_FAILURES_DIR = "data/canary-failures";

type ScraperFailure = {
  message: string;
  url?: string;
};

type ScraperReport = {
  slug: string;
  checked: number;
  passed: number;
  skipped: number;
  failures: ScraperFailure[];
  noListings: boolean;
  scraperError?: string;
};

type CheckResult =
  | { status: "pass" }
  | { status: "skip" }
  | { status: "fail"; message: string };

const FLATS_PER_SCRAPER = 2;
const MAX_ATTEMPTS_PER_SCRAPER = 5;
const scraperEntries = Object.entries(propertyManagements) as Array<
  [PropertyManagementId, PropertyManagement]
>;

function shortUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname.length > 72 ? `…${pathname.slice(-69)}` : pathname;
  } catch {
    return url;
  }
}

function failurePath(url: string, slug: string): string {
  const urlPath = new URL(url).pathname.replaceAll("/", "-");
  const fileName = (slug + urlPath).replace(".html", "");
  return `${CANARY_FAILURES_DIR}/${fileName}.html`;
}

async function checkUrl(
  scraper: PropertyManagement,
  url: string,
  propertyManagementId: PropertyManagementId,
): Promise<CheckResult> {
  try {
    const html = await fetchHtml(url, scraper.getFetchOptions?.());

    let flat;
    try {
      flat = scraper.extractDataFromHtml(html, url);
    } catch (error) {
      const path = failurePath(url, scraper.slug);
      await Bun.write(path, html);
      throw error;
    }

    if (
      shouldIgnoreListing({
        title: flat.title,
        propertyManagementId,
        coldRentPrice: flat.coldRentPrice,
        warmRentPrice: flat.warmRentPrice,
        roomCount: flat.roomCount,
      })
    ) {
      console.log(`  ○ ${shortUrl(url)} — skipped (ignored listing)`);
      return { status: "skip" };
    }

    try {
      assertFlatShape(flat, url);
    } catch (error) {
      const path = failurePath(url, scraper.slug);
      await Bun.write(path, html);
      throw error;
    }

    console.log(
      `  ✓ ${shortUrl(url)} — ${flat.coldRentPrice}€, ${flat.roomCount} Zi, ${flat.usableArea}m²`,
    );
    return { status: "pass" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ ${shortUrl(url)} — ${message}`);
    return { status: "fail", message };
  }
}

async function runCanary(): Promise<ScraperReport[]> {
  const startedAt = performance.now();
  console.log(
    `Scraper canary — ${scraperEntries.length} scrapers, ${FLATS_PER_SCRAPER} flats each\n`,
  );

  const reports: ScraperReport[] = [];

  for (const [
    index,
    [propertyManagementId, scraper],
  ] of scraperEntries.entries()) {
    console.log(`${scraper.slug} (${index + 1}/${scraperEntries.length})`);

    const report: ScraperReport = {
      slug: scraper.slug,
      checked: 0,
      passed: 0,
      skipped: 0,
      failures: [],
      noListings: false,
    };

    try {
      const urls = await scraper.extractUrls();

      if (urls.length === 0) {
        console.log("  ✗ no listings\n");
        report.noListings = true;
        report.failures.push({
          message: `${scraper.slug}: extractUrls returned no listings`,
        });
        reports.push(report);
        continue;
      }

      console.log(
        `  ${urls.length} listings, looking for ${FLATS_PER_SCRAPER} flats`,
      );

      let attempts = 0;

      for (const url of urls) {
        if (report.passed >= FLATS_PER_SCRAPER) break;
        if (attempts >= MAX_ATTEMPTS_PER_SCRAPER) break;

        const result = await checkUrl(scraper, url, propertyManagementId);

        if (result.status === "skip") {
          report.skipped++;
        } else {
          attempts++;
          report.checked++;
          if (result.status === "pass") {
            report.passed++;
          } else {
            report.failures.push({ url, message: result.message });
          }
        }

        const needsMore =
          report.passed < FLATS_PER_SCRAPER &&
          attempts < MAX_ATTEMPTS_PER_SCRAPER;
        if (needsMore) {
          await Bun.sleep(500 + Math.random() * 1000);
        }
      }

      if (report.passed < FLATS_PER_SCRAPER) {
        report.failures.push({
          message: `${scraper.slug}: only passed ${report.passed}/${FLATS_PER_SCRAPER} after ${attempts} attempt(s)`,
        });
      }

      console.log("");
    } catch (error) {
      report.scraperError =
        error instanceof Error ? error.message : String(error);
      console.log(`  ✗ ${report.scraperError}\n`);
    }

    reports.push(report);
  }

  const elapsedSec = Math.round((performance.now() - startedAt) / 1000);
  const failedScrapers = reports.filter(
    (report) => report.scraperError || report.failures.length > 0,
  ).length;
  const passedChecks = reports.reduce((sum, report) => sum + report.passed, 0);
  const totalChecks = reports.reduce((sum, report) => sum + report.checked, 0);

  console.log(
    `Done in ${elapsedSec}s — ${passedChecks}/${totalChecks} flats passed, ${failedScrapers} scraper(s) with issues`,
  );

  return reports;
}

const reports = await runCanary();
const failed = reports.some(
  (report) => report.scraperError || report.failures.length > 0,
);
process.exit(failed ? 1 : 0);
