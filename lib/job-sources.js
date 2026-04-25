import { normalizeSourceLink } from "@/lib/jobs-ingestion";

const REQUEST_TIMEOUT_MS = Number(process.env.JOB_SOURCE_TIMEOUT_MS || 12000);

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

export async function fetchFallbackJobs({ query, location = "india", limit = 8 }) {
  const adzuna = await fetchAdzunaJobs({ query, location, limit });
  if (adzuna.length) return adzuna;

  const jsearch = await fetchJSearchJobs({ query: `${query} in india`, limit });
  if (jsearch.length) return jsearch;

  return fetchIndianApiJobs({ query, location: "india", limit });
}
