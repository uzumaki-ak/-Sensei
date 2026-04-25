import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { parseJsonFromProcessOutput } from "@/lib/jobs-ingestion";
import { fetchFallbackJobs } from "@/lib/job-sources";

const execPromise = promisify(exec);
const DISCOVERY_TIMEOUT_MS = Number(process.env.HUNT_DISCOVERY_TIMEOUT_MS || 20000);
const SCRAPE_TIMEOUT_MS = Number(process.env.HUNT_SCRAPE_TIMEOUT_MS || 30000);

function escapeForDoubleQuotes(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function GET(request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { industry: true, skills: true }
  });

  if (!user || !user.industry) {
    return NextResponse.json({ error: "Please complete onboarding to use dynamic hunt." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  // Dynamic Query Construction
  const defaultQuery = `${user.industry} jobs ${user.skills?.slice(0, 2).join(" ")}`;
  const query = searchParams.get("query") || defaultQuery;

  console.log(`[API TEST] Launching Dynamic Elite Hunt for: ${query}`);

  try {
    // 1. Trigger Discovery (Real Python Bridge)
    const { stdout: discoveryOut } = await execPromise(`python scripts/crawler/discovery.py "${escapeForDoubleQuotes(query)}"`, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() + "/scripts/crawler" },
      timeout: DISCOVERY_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    const discoveryParsed = parseJsonFromProcessOutput(discoveryOut);
    const discovered_urls = discoveryParsed?.discovered_urls || [];

    if (!discovered_urls || discovered_urls.length === 0) {
      const fallbackJobs = await fetchFallbackJobs({
        query,
        location: user.industry,
        limit: 5,
      });

      return NextResponse.json({
        success: fallbackJobs.length > 0,
        query,
        discoveredUrls: 0,
        fallbackCount: fallbackJobs.length,
        fallbackJobs,
        message: fallbackJobs.length
          ? "Scraper returned no URLs, fallback API jobs returned."
          : "No jobs discovered and no fallback results. Check API keys.",
      });
    }

    // 2. Trigger Deep Scrape for the top one
    const targetUrl = discovered_urls[0];
    const { stdout: scrapeOut } = await execPromise(`python scripts/crawler/main.py "${escapeForDoubleQuotes(targetUrl)}"`, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() + "/scripts/crawler" },
      timeout: SCRAPE_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    const scrapedData = parseJsonFromProcessOutput(scrapeOut);

    return NextResponse.json({
      success: true,
      query,
      targetUrl,
      result: scrapedData,
      message: "Full Pipeline (Discovery -> Scrape) verified successfully!"
    });

  } catch (error) {
    console.error("[API TEST ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
