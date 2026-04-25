import asyncio
import json
import sys
from urllib.parse import quote_plus

from engine import CrawlerEngine

MAX_LINKS = 20
SEARCH_URLS = [
    "https://www.linkedin.com/jobs/search?keywords={query}",
    "https://www.indeed.com/jobs?q={query}",
    "https://internshala.com/jobs/keywords-{query}",
    "https://www.naukri.com/{query}-jobs",
    "https://www.foundit.in/srp/results?query={query}",
    "https://www.shine.com/job-search/{query}-jobs",
    "https://www.timesjobs.com/candidate/job-search.html?searchType=personalizedSearch&from=submit&txtKeywords={query}",
    "https://apna.co/jobs?search={query}",
    "https://www.workindia.in/jobs-in-all-india/{query}",
    "https://www.upwork.com/nx/search/jobs/?q={query}",
    "https://www.freejobalert.com/?s={query}",
    "https://www.ncs.gov.in/Pages/Search.aspx?q={query}",
    "https://angel.co/jobs?q={query}",
]


def log(message):
    print(message, file=sys.stderr)


class DiscoveryEngine:
    async def run_discovery(self, query):
        engine = CrawlerEngine(headless=True)
        encoded_query = quote_plus(query)
        all_links = []

        for template in SEARCH_URLS:
            search_url = template.format(query=encoded_query)
            log(f"[DISCOVERY] Searching: {search_url}")

            try:
                result = await engine.scrape_url(search_url, self.extract_links)
                links = result.get("discovered_urls", []) if result else []
                all_links.extend(links)
            except Exception as error:
                log(f"[DISCOVERY] Failed source {search_url}: {error}")

            if len(all_links) >= MAX_LINKS:
                break

        deduped = []
        seen = set()

        for link in all_links:
            if not isinstance(link, str):
                continue
            cleaned = link.strip()
            if not cleaned or cleaned in seen:
                continue
            seen.add(cleaned)
            deduped.append(cleaned)
            if len(deduped) >= MAX_LINKS:
                break

        return {"discovered_urls": deduped}

    async def extract_links(self, page):
        log("[DISCOVERY] Extracting job links")
        links = await page.evaluate(
            """() => {
                const raw = Array.from(document.querySelectorAll("a"))
                    .map((anchor) => anchor.href || "")
                    .filter(Boolean);

                const allowed = [
                  /linkedin\\.com\\/jobs\\/view\\//i,
                  /indeed\\.com\\/(viewjob|rc\\/clk)/i,
                  /internshala\\.com\\/(job|internship)/i,
                  /naukri\\.com\\/job-listings/i,
                  /foundit\\.in\\/job\\//i,
                  /shine\\.com\\/jobs\\//i,
                  /timesjobs\\.com\\/candidate\\/job-search/i,
                  /apna\\.co\\/job\\//i,
                  /workindia\\.in\\/jobs\\//i,
                  /upwork\\.com\\/(jobs|freelance-jobs)\\//i,
                  /freejobalert\\.com\\//i,
                  /ncs\\.gov\\.in\\/Pages\\//i,
                  /(wellfound|angel)\\.com\\/jobs\\//i,
                  /glassdoor\\..*\\/job-listing\\//i,
                  /workatastartup\\.com\\/jobs\\//i,
                  /ycombinator\\.com\\/companies\\/.*\\/jobs/i
                ];

                return raw.filter((href) => allowed.some((pattern) => pattern.test(href)));
            }"""
        )
        return {"discovered_urls": links[:15]}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No query provided"}))
        sys.exit(1)

    query = sys.argv[1]
    discovery = DiscoveryEngine()

    async def main():
        links = await discovery.run_discovery(query)
        print(json.dumps(links))

    asyncio.run(main())
