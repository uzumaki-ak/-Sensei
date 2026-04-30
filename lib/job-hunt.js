import { exec } from "child_process";
import { promisify } from "util";
import {
  createJobPayload,
  isHttpUrl,
  isLikelyJobUrl,
  normalizeSourceLink,
  parseJsonFromProcessOutput,
  upsertJobApplicationForUser,
} from "@/lib/jobs-ingestion";
import { fetchFallbackJobs } from "@/lib/job-sources";

const execPromise = promisify(exec);

const MAX_QUERIES_PER_USER = Number(process.env.HUNT_MAX_QUERIES_PER_USER || 4);
const MAX_URLS_PER_USER = Number(process.env.HUNT_MAX_URLS_PER_USER || 6);
const MIN_CREATED_BEFORE_FALLBACK = Number(process.env.HUNT_MIN_CREATED_BEFORE_FALLBACK || 1);
const MAX_FALLBACK_JOBS_PER_QUERY = Number(process.env.HUNT_MAX_FALLBACK_PER_QUERY || 8);
const DISCOVERY_TIMEOUT_MS = Number(process.env.HUNT_DISCOVERY_TIMEOUT_MS || 45000);
const SCRAPE_TIMEOUT_MS = Number(process.env.HUNT_SCRAPE_TIMEOUT_MS || 45000);
const PYTHON_DISCOVERY_TIMEOUT_MS = Number(process.env.HUNT_PYTHON_CHECK_TIMEOUT_MS || 5000);
const CRAWLER_HTTP_TIMEOUT_MS = Number(process.env.HUNT_CRAWLER_TIMEOUT_MS || 70000);
const CRAWLER_RETRIES = Math.max(0, Number(process.env.HUNT_CRAWLER_RETRIES || 1));
const CRAWLER_RETRY_BACKOFF_MS = Number(process.env.HUNT_CRAWLER_RETRY_BACKOFF_MS || 1500);
const CRAWLER_DISCOVERY_BUDGET_MS = Number(process.env.HUNT_CRAWLER_DISCOVERY_BUDGET_MS || 90000);
const CRAWLER_BASE_URL = process.env.HUNT_CRAWLER_URL?.trim();
const CRAWLER_TOKEN =
  process.env.HUNT_CRAWLER_TOKEN?.trim() ||
  process.env.CRAWLER_API_TOKEN?.trim();

let cachedPythonCommand = null;
let pythonCommandResolved = false;

function escapeForDoubleQuotes(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function looksLikeCommandMissing(error) {
  const message = `${error?.message || ""}\n${error?.stderr || ""}`;
  return /not found|is not recognized|ENOENT/i.test(message);
}

function buildCrawlerHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (CRAWLER_TOKEN) {
    headers.Authorization = `Bearer ${CRAWLER_TOKEN}`;
  }
  return headers;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortLikeError(error) {
  return error?.name === "AbortError" || /aborted/i.test(String(error?.message || ""));
}

function isNetworkLikeError(error) {
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket|network/i.test(
    String(error?.message || "")
  );
}

async function callCrawler(path, payload) {
  if (!CRAWLER_BASE_URL) return null;
  const base = CRAWLER_BASE_URL.endsWith("/")
    ? CRAWLER_BASE_URL.slice(0, -1)
    : CRAWLER_BASE_URL;

  for (let attempt = 0; attempt <= CRAWLER_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CRAWLER_HTTP_TIMEOUT_MS);

    try {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: buildCrawlerHeaders(),
        body: JSON.stringify(payload || {}),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const error = new Error(
          `Crawler HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`
        );
        error.status = response.status;
        throw error;
      }

      return response.json();
    } catch (error) {
      const status = Number(error?.status || 0);
      const shouldRetry =
        attempt < CRAWLER_RETRIES &&
        (isAbortLikeError(error) || isNetworkLikeError(error) || status >= 500);

      if (!shouldRetry) throw error;
      await sleep(CRAWLER_RETRY_BACKOFF_MS * (attempt + 1));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

async function resolvePythonCommand() {
  if (pythonCommandResolved) return cachedPythonCommand;

  const candidates = [
    process.env.HUNT_PYTHON_BIN?.trim(),
    "python",
    "python3",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await execPromise(`${candidate} --version`, {
        cwd: process.cwd(),
        env: { ...process.env },
        timeout: PYTHON_DISCOVERY_TIMEOUT_MS,
        maxBuffer: 128 * 1024,
      });
      cachedPythonCommand = candidate;
      pythonCommandResolved = true;
      return cachedPythonCommand;
    } catch (error) {
      if (!looksLikeCommandMissing(error)) {
        console.error(`[Hunt] Failed probing Python command "${candidate}":`, error.message);
      }
    }
  }

  cachedPythonCommand = null;
  pythonCommandResolved = true;
  return null;
}

import { getModel } from "@/lib/gemini";

export async function buildDiscoveryQueries(user) {
  const skills = Array.isArray(user.skills) ? user.skills.filter(Boolean) : [];
  const personas = Array.isArray(user.personas) ? user.personas : [];

  const querySet = new Set();

  try {
    // Use AI to generate optimized search queries based on your skills
    const model = getModel();
    const prompt = `
You are a job search query optimizer.

User skills: ${skills.join(", ")}
User industry: ${user.industry || "software development"}

Generate 5-6 effective job search queries.
Rules:
- Mix of role-based + skill-based queries
- Include both broad and specific searches
- No keyword stuffing
- Target different role types (junior, mid, frontend, backend, full stack, app dev)
- Use real job titles people actually search for

Return ONLY a JSON array of strings, no extra text.
Example: ["full stack developer jobs", "react frontend engineer jobs", "python backend developer jobs", "software engineer remote"]
    `;
    
    const result = await model.generateContent(prompt);
    const aiQueries = JSON.parse(result.response.text().trim());
    
    for (const q of aiQueries) {
      querySet.add(q);
    }
  } catch (error) {
    console.log('[Hunt] AI query generation failed, using fallback:', error.message);
  }

  // Fallback queries if AI fails
  if (querySet.size < 2) {
    if (user.industry) {
      querySet.add(`${user.industry} jobs`);
      querySet.add(`${user.industry} remote jobs`);
    }
    
    // Add skill-based queries
    for (let i = 0; i < Math.min(skills.length, 2); i++) {
      querySet.add(`${skills[i]} developer jobs`);
    }
    
    // Add common roles
    querySet.add("software engineer jobs");
    querySet.add("full stack developer jobs");
    querySet.add("frontend developer jobs");
    querySet.add("backend developer jobs");
  }

  // Add persona queries
  for (const persona of personas) {
    const personaName = typeof persona?.name === "string" ? persona.name.trim() : "";
    if (personaName) {
      querySet.add(`${personaName} jobs`);
    }
  }

  return [...querySet].slice(0, MAX_QUERIES_PER_USER);
}

async function discoverUrls(query) {
  if (CRAWLER_BASE_URL) {
    const data = await callCrawler("/discover", { query });
    return Array.isArray(data?.discovered_urls) ? data.discovered_urls : [];
  }

  const pythonCommand = await resolvePythonCommand();
  if (!pythonCommand) {
    throw new Error("Python runtime unavailable on this server");
  }

  const command = `${pythonCommand} scripts/crawler/discovery.py "${escapeForDoubleQuotes(query)}"`;
  const { stdout } = await execPromise(command, {
    cwd: process.cwd(),
    env: { ...process.env, PYTHONPATH: `${process.cwd()}/scripts/crawler` },
    timeout: DISCOVERY_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });

  const parsed = parseJsonFromProcessOutput(stdout);
  return Array.isArray(parsed?.discovered_urls) ? parsed.discovered_urls : [];
}

async function scrapeUrl(url) {
  if (CRAWLER_BASE_URL) {
    const data = await callCrawler("/scrape", { url });
    return data || {};
  }

  const pythonCommand = await resolvePythonCommand();
  if (!pythonCommand) {
    throw new Error("Python runtime unavailable on this server");
  }

  const command = `${pythonCommand} scripts/crawler/main.py "${escapeForDoubleQuotes(url)}"`;
  const { stdout } = await execPromise(command, {
    cwd: process.cwd(),
    env: { ...process.env, PYTHONPATH: `${process.cwd()}/scripts/crawler` },
    timeout: SCRAPE_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });

  return parseJsonFromProcessOutput(stdout);
}

function mapFallbackToJobPayload(sourceJob) {
  return createJobPayload({
    sourceLink: sourceJob.sourceLink,
    title: sourceJob.title,
    company: sourceJob.company,
    description: sourceJob.description,
    techStack: sourceJob.techStack,
    recruiterEmail: sourceJob.recruiterEmail,
    rawText: sourceJob.description,
  });
}

export async function runJobHuntForUser(user, options = {}) {
  const status = options.status || "Discovered";
  const log = typeof options.log === "function" ? options.log : () => {};
  const queries = await buildDiscoveryQueries(user);

  console.log('[HUNT] Running with queries:', queries);
  
  const totals = {
    queriesTried: queries.length,
    discoveredUrls: 0,
    scrapedUrls: 0,
    fallbackJobsFetched: 0,
    createdApplications: 0,
    refreshedApplications: 0,
    failedUrls: 0,
  };

  const newApplications = [];
  const candidateUrls = new Set();
  let crawlerAvailable = true;
  const discoveryStartedAt = Date.now();

  for (const query of queries) {
    if (!crawlerAvailable) break;
    if (
      CRAWLER_BASE_URL &&
      Date.now() - discoveryStartedAt > CRAWLER_DISCOVERY_BUDGET_MS
    ) {
      crawlerAvailable = false;
      log("[Hunt] Discovery budget exceeded for crawler; using API fallbacks only.");
      break;
    }

    try {
      const discovered = await discoverUrls(query);
      for (const raw of discovered) {
        const normalized = normalizeSourceLink(raw);
        if (!isHttpUrl(normalized) || !isLikelyJobUrl(normalized)) continue;
        candidateUrls.add(normalized);
        if (candidateUrls.size >= MAX_URLS_PER_USER) break;
      }
    } catch (error) {
      log(`[Hunt] Discovery failed for query "${query}": ${error.message}`);
      const errorMessage = String(error.message || "");
      if (errorMessage.includes("Python runtime unavailable")) {
        crawlerAvailable = false;
        log("[Hunt] Python crawler unavailable in this environment; using API fallbacks only.");
      }
      if (errorMessage.includes("Crawler HTTP 401") || errorMessage.includes("Crawler HTTP 403")) {
        crawlerAvailable = false;
        log("[Hunt] External crawler auth failed; using API fallbacks only.");
      }
      if (isAbortLikeError(error)) {
        crawlerAvailable = false;
        log("[Hunt] External crawler timed out; using API fallbacks only.");
      }
      if (errorMessage.includes("Crawler HTTP") && !crawlerAvailable) {
        continue;
      }
      if (errorMessage.includes("Crawler HTTP")) {
        crawlerAvailable = false;
        log("[Hunt] External crawler endpoint unavailable; using API fallbacks only.");
      }
    }

    if (candidateUrls.size >= MAX_URLS_PER_USER) break;
  }

  totals.discoveredUrls = candidateUrls.size;

  for (const url of candidateUrls) {
    try {
      const scrapedData = await scrapeUrl(url);
      totals.scrapedUrls += 1;

      const payload = createJobPayload({
        sourceLink: url,
        title: scrapedData.title,
        company: scrapedData.company,
        description: scrapedData.description,
        techStack: scrapedData.techStack,
        recruiterEmail: scrapedData.recruiterEmail,
        rawText: scrapedData.raw_text || scrapedData.rawText,
      });

      const { application, created } = await upsertJobApplicationForUser({
        userId: user.id,
        status,
        job: payload,
      });

      if (created) {
        totals.createdApplications += 1;
        newApplications.push(application);
      } else {
        totals.refreshedApplications += 1;
      }
    } catch (error) {
      totals.failedUrls += 1;
      log(`[Hunt] Scrape failed for URL "${url}": ${error.message}`);
    }
  }

  console.log('[HUNT] Scraping complete. Created:', totals.createdApplications, 'Total URLs:', candidateUrls.size);

  // Always use fallback jobs - crawler is unreliable on LinkedIn/Indeed
  for (const query of queries) {
    console.log('[HUNT] Fetching fallback jobs for:', query);
    let fallbackJobs = [];
    try {
      fallbackJobs = await fetchFallbackJobs({
        query,
        location: "india",
        limit: MAX_FALLBACK_JOBS_PER_QUERY,
      });
    } catch (error) {
      log(`[HUNT] Fallback source fetch failed for "${query}": ${error.message}`);
      continue;
    }

    if (!fallbackJobs.length) continue;

    totals.fallbackJobsFetched += fallbackJobs.length;
    console.log('[HUNT] Found', fallbackJobs.length, 'fallback jobs for', query);

    for (const fallbackJob of fallbackJobs) {
      try {
        if (!isHttpUrl(fallbackJob.sourceLink) || !isLikelyJobUrl(fallbackJob.sourceLink)) {
          continue;
        }

        const payload = mapFallbackToJobPayload(fallbackJob);
        const { application, created } = await upsertJobApplicationForUser({
          userId: user.id,
          status,
          job: payload,
        });

        if (created) {
          totals.createdApplications += 1;
          newApplications.push(application);
          console.log('[HUNT] Created job:', payload.title, '@', payload.company);
        } else {
          totals.refreshedApplications += 1;
        }
      } catch (error) {
        totals.failedUrls += 1;
        log(`[HUNT] Fallback ingest failed: ${error.message}`);
      }
    }

    if (totals.createdApplications >= 6) {
      break;
    }
  }

  return {
    totals,
    newApplications,
    queries,
  };
}
