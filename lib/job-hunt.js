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

function escapeForDoubleQuotes(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
  const command = `python scripts/crawler/discovery.py "${escapeForDoubleQuotes(query)}"`;
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
  const command = `python scripts/crawler/main.py "${escapeForDoubleQuotes(url)}"`;
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

  for (const query of queries) {
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
    const fallbackJobs = await fetchFallbackJobs({
      query,
      location: "india",
      limit: MAX_FALLBACK_JOBS_PER_QUERY,
    });

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
