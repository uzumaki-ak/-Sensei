import { normalizeSourceLink } from "@/lib/jobs-ingestion";

const REQUEST_TIMEOUT_MS = Number(process.env.JOB_SOURCE_TIMEOUT_MS || 12000);
const DEFAULT_SOURCE_FETCH_LIMIT = Number(process.env.JOB_SOURCE_PER_SOURCE_LIMIT || 20);
const FALLBACK_OVERSAMPLE = Number(process.env.JOB_SOURCE_OVERSAMPLE || 3);
const QUERY_STOP_WORDS = new Set([
  "job",
  "jobs",
  "developer",
  "engineer",
  "remote",
  "india",
  "in",
  "for",
  "with",
  "and",
  "the",
  "a",
  "an",
  "to",
]);

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeText(value, maxLength = 12000) {
  if (!value) return null;
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function tokenizeQuery(query) {
  return String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !QUERY_STOP_WORDS.has(token));
}

function scoreJobAgainstQuery(job, queryTokens) {
  if (!queryTokens.length) return 0;

  const haystack = [
    job?.title,
    job?.company,
    job?.description,
    ...(Array.isArray(job?.techStack) ? job.techStack : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += token.length >= 4 ? 2 : 1;
    }
  }

  if (job?.description) score += 1;
  return score;
}

function rankJobsByQuery(jobs, query) {
  const tokens = tokenizeQuery(query);
  if (!tokens.length) return jobs;

  return [...jobs]
    .map((job) => ({ job, score: scoreJobAgainstQuery(job, tokens) }))
    .sort((a, b) => b.score - a.score)
    .map(({ job }) => job);
}

function dedupeJobsBySourceLink(jobs) {
  const seen = new Set();
  const deduped = [];

  for (const job of jobs) {
    const sourceLink = normalizeSourceLink(job?.sourceLink || "");
    if (!sourceLink || seen.has(sourceLink)) continue;
    seen.add(sourceLink);
    deduped.push({ ...job, sourceLink });
  }

  return deduped;
}

function mapAdzunaJob(job) {
  return {
    title: normalizeText(job?.title, 180),
    company: normalizeText(job?.company?.display_name, 180),
    description: normalizeText(job?.description),
    sourceLink: normalizeSourceLink(job?.redirect_url || ""),
    techStack: [],
    recruiterEmail: null,
  };
}

function mapJSearchJob(job) {
  return {
    title: normalizeText(job?.job_title, 180),
    company: normalizeText(job?.employer_name, 180),
    description: normalizeText(job?.job_description),
    sourceLink: normalizeSourceLink(job?.job_apply_link || job?.job_google_link || ""),
    techStack: [],
    recruiterEmail: null,
  };
}

function mapIndianApiJob(job) {
  return {
    title: normalizeText(job?.title || job?.job_title, 180),
    company: normalizeText(job?.company || job?.company_name, 180),
    description: normalizeText(job?.description || job?.job_description),
    sourceLink: normalizeSourceLink(job?.applyLink || job?.apply_url || job?.url || ""),
    techStack: [],
    recruiterEmail: null,
  };
}

function mapRemotiveJob(job) {
  return {
    title: normalizeText(job?.title, 180),
    company: normalizeText(job?.company_name, 180),
    description: normalizeText(job?.description),
    sourceLink: normalizeSourceLink(job?.url || ""),
    techStack: [],
    recruiterEmail: null,
  };
}

function mapArbeitnowJob(job) {
  return {
    title: normalizeText(job?.title, 180),
    company: normalizeText(job?.company_name, 180),
    description: normalizeText(job?.description),
    sourceLink: normalizeSourceLink(job?.url || ""),
    techStack: Array.isArray(job?.tags) ? job.tags.slice(0, 8) : [],
    recruiterEmail: null,
  };
}

export async function fetchAdzunaJobs({ query, location = "india", limit = 10 }) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const url = new URL("https://api.adzuna.com/v1/api/jobs/in/search/1");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("what", query);
  url.searchParams.set("where", location);
  url.searchParams.set("results_per_page", String(limit));

  try {
    const data = await fetchWithTimeout(url.toString());
    const jobs = Array.isArray(data?.results) ? data.results : [];
    return jobs.map(mapAdzunaJob);
  } catch (error) {
    console.error("[JobSources] Adzuna fallback failed:", error.message);
    return [];
  }
}

export async function fetchJSearchJobs({ query, limit = 10 }) {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_JSEARCH_HOST || "jsearch.p.rapidapi.com";
  if (!key) return [];

  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("num_pages", "1");

  try {
    const data = await fetchWithTimeout(url.toString(), {
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": host,
      },
    });

    const jobs = Array.isArray(data?.data) ? data.data : [];
    return jobs.slice(0, limit).map(mapJSearchJob);
  } catch (error) {
    console.error("[JobSources] JSearch fallback failed:", error.message);
    return [];
  }
}

export async function fetchIndianApiJobs({ query, location = "india", limit = 10 }) {
  const key = process.env.INDIANAPI_API_KEY;
  if (!key) return [];

  const url = new URL("https://jobs.indianapi.in/jobs");
  url.searchParams.set("keyword", query);
  url.searchParams.set("location", location);

  try {
    const data = await fetchWithTimeout(url.toString(), {
      headers: {
        "X-Api-Key": key,
      },
    });

    const jobs = Array.isArray(data?.jobs)
      ? data.jobs
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];

    return jobs.slice(0, limit).map(mapIndianApiJob);
  } catch (error) {
    console.error("[JobSources] IndianAPI fallback failed:", error.message);
    return [];
  }
}

export async function fetchRemotiveJobs({ query, limit = 10 }) {
  const url = new URL("https://remotive.com/api/remote-jobs");
  if (query) {
    url.searchParams.set("search", query);
  }
  url.searchParams.set("limit", String(limit));

  try {
    const data = await fetchWithTimeout(url.toString());
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
    return jobs.slice(0, limit).map(mapRemotiveJob);
  } catch (error) {
    console.error("[JobSources] Remotive fallback failed:", error.message);
    return [];
  }
}

export async function fetchArbeitnowJobs({ query, limit = 10 }) {
  const url = "https://arbeitnow.com/api/job-board-api";

  try {
    const data = await fetchWithTimeout(url);
    const jobs = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.jobs)
        ? data.jobs
        : Array.isArray(data)
          ? data
          : [];

    const mapped = jobs.map(mapArbeitnowJob);
    return rankJobsByQuery(mapped, query).slice(0, limit);
  } catch (error) {
    console.error("[JobSources] Arbeitnow fallback failed:", error.message);
    return [];
  }
}

export async function fetchFallbackJobs({ query, location = "india", limit = 8 }) {
  const safeLimit = Math.max(1, Number(limit) || 8);
  const perSourceLimit = Math.max(
    safeLimit,
    Math.min(DEFAULT_SOURCE_FETCH_LIMIT, safeLimit * Math.max(1, FALLBACK_OVERSAMPLE))
  );

  const [adzuna, jsearch, indianApi, arbeitnow, remotive] = await Promise.all([
    fetchAdzunaJobs({ query, location, limit: perSourceLimit }),
    fetchJSearchJobs({ query: `${query} in india`, limit: perSourceLimit }),
    fetchIndianApiJobs({ query, location: "india", limit: perSourceLimit }),
    fetchArbeitnowJobs({ query, limit: perSourceLimit }),
    fetchRemotiveJobs({ query, limit: perSourceLimit }),
  ]);

  const merged = dedupeJobsBySourceLink([
    ...adzuna,
    ...jsearch,
    ...indianApi,
    ...arbeitnow,
    ...remotive,
  ]);

  return rankJobsByQuery(merged, query).slice(0, safeLimit);
}
