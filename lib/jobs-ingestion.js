import { db } from "@/lib/prisma";

const TRACKING_QUERY_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "refid",
  "trk",
  "trackingid",
  "sessionid",
];

const STATUS_PRIORITY = {
  Discovered: 0,
  "To Apply": 1,
  Applied: 2,
  Interviewing: 3,
  Offer: 4,
  Rejected: 5,
};

const GENERIC_PLACEHOLDER_PATTERN = /^(unknown|job opportunity|checking|discovered via ai)/i;

export function parseJsonFromProcessOutput(output) {
  if (!output || !output.trim()) {
    throw new Error("Process returned empty output");
  }

  const trimmed = output.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to line-based recovery.
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      // Continue searching for valid JSON.
    }
  }

  for (let start = lines.length - 1; start >= 0; start--) {
    const candidate = lines.slice(start).join("\n");
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue searching for valid JSON.
    }
  }

  throw new Error("Unable to parse JSON from process output");
}

export function normalizeSourceLink(input) {
  const raw = (input || "").trim();
  if (!raw) return raw;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return raw;
  }

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_QUERY_PARAMS.includes(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
      url.searchParams.delete(key);
    }
  }

  url.hash = "";

  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isLikelyJobUrl(value) {
  if (!isHttpUrl(value)) return false;

  const normalized = normalizeSourceLink(value).toLowerCase();
  const patterns = [
    /linkedin\.com\/jobs\/view\//,
    /indeed\.com\/(viewjob|rc\/clk)/,
    /internshala\.com\/(job|internship)/,
    /naukri\.com\/job-listings/,
    /(wellfound|angel)\.com\/jobs\//,
    /glassdoor\..*\/job-listing\//,
    /workatastartup\.com\/jobs\//,
    /ycombinator\.com\/companies\/.*\/jobs/,
  ];

  if (patterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  try {
    const url = new URL(normalized);
    const combined = `${url.pathname} ${url.search}`;
    return /(job|career|opening|position|hiring)/.test(combined);
  } catch {
    return false;
  }
}

export function sanitizeTechStack(techStack) {
  if (!Array.isArray(techStack)) return [];

  const seen = new Set();
  const cleaned = [];

  for (const item of techStack) {
    const value = String(item || "").trim();
    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(value);

    if (cleaned.length >= 15) break;
  }

  return cleaned;
}

function normalizeText(input, maxLength = 10000) {
  if (!input) return null;
  const value = String(input).replace(/\s+/g, " ").trim();
  if (!value) return null;
  return value.slice(0, maxLength);
}

function fallbackCompanyFromHost(sourceLink) {
  try {
    const host = new URL(sourceLink).hostname.replace(/^www\./, "");
    const mapped = {
      "linkedin.com": "LinkedIn",
      "indeed.com": "Indeed",
      "internshala.com": "Internshala",
      "naukri.com": "Naukri",
      "wellfound.com": "Wellfound",
      "glassdoor.com": "Glassdoor",
      "workatastartup.com": "Work at a Startup",
    };
    if (mapped[host]) return mapped[host];

    const base = host.split(".")[0] || "Unknown Company";
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return "Unknown Company";
  }
}

function extractEmail(candidateText, explicitEmail) {
  const explicit = normalizeText(explicitEmail, 320);
  if (explicit && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(explicit)) {
    return explicit;
  }

  const text = String(candidateText || "");
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const preferred = matches.find((email) => !/(no-?reply|donotreply|do-not-reply)/i.test(email));

  return preferred || matches[0] || null;
}

export function createJobPayload({
  sourceLink,
  title,
  company,
  description,
  techStack,
  recruiterEmail,
  rawText,
}) {
  const normalizedLink = normalizeSourceLink(sourceLink);
  const normalizedDescription = normalizeText(description, 12000) || normalizeText(rawText, 12000);
  const normalizedTitle = normalizeText(title, 180);
  const normalizedCompany = normalizeText(company, 180);

  return {
    sourceLink: normalizedLink,
    title: normalizedTitle || `Job opportunity from ${fallbackCompanyFromHost(normalizedLink)}`,
    company: normalizedCompany || fallbackCompanyFromHost(normalizedLink),
    description: normalizedDescription,
    techStack: sanitizeTechStack(techStack),
    recruiterEmail: extractEmail(`${normalizedDescription || ""}\n${rawText || ""}`, recruiterEmail),
  };
}

function shouldUseIncoming(currentValue, incomingValue) {
  if (!incomingValue) return false;
  if (!currentValue) return true;
  if (GENERIC_PLACEHOLDER_PATTERN.test(currentValue) && !GENERIC_PLACEHOLDER_PATTERN.test(incomingValue)) {
    return true;
  }
  return incomingValue.length > currentValue.length;
}

function shouldPromoteStatus(currentStatus, incomingStatus) {
  if (!incomingStatus || !STATUS_PRIORITY.hasOwnProperty(incomingStatus)) {
    return false;
  }
  if (!currentStatus || !STATUS_PRIORITY.hasOwnProperty(currentStatus)) {
    return true;
  }

  if (currentStatus === "Rejected" && incomingStatus !== "Rejected") {
    return false;
  }

  return STATUS_PRIORITY[incomingStatus] > STATUS_PRIORITY[currentStatus];
}

async function mergeListingData(listingId, existingListing, incomingPayload) {
  const data = {
    title: shouldUseIncoming(existingListing.title, incomingPayload.title)
      ? incomingPayload.title
      : existingListing.title,
    company: shouldUseIncoming(existingListing.company, incomingPayload.company)
      ? incomingPayload.company
      : existingListing.company,
    description:
      shouldUseIncoming(existingListing.description || "", incomingPayload.description || "")
        ? incomingPayload.description
        : existingListing.description,
    techStack:
      incomingPayload.techStack.length >= (existingListing.techStack?.length || 0)
        ? incomingPayload.techStack
        : existingListing.techStack,
    recruiterEmail: incomingPayload.recruiterEmail || existingListing.recruiterEmail,
  };

  return db.jobListing.update({
    where: { id: listingId },
    data,
  });
}

export async function upsertJobApplicationForUser({ userId, status = "Discovered", job }) {
  const payload = createJobPayload(job);

  // First check if listing exists
  let existingListing = await db.jobListing.findFirst({
    where: { sourceLink: payload.sourceLink },
    orderBy: { scrapedAt: "desc" },
  });

  // If listing exists, check if user has application for it
  let existingApplication = null;
  if (existingListing) {
    existingApplication = await db.jobApplication.findFirst({
      where: {
        userId,
        jobId: existingListing.id
      },
      include: { job: true },
      orderBy: { createdAt: "desc" },
    });
  }

  if (existingApplication) {
    await mergeListingData(existingApplication.job.id, existingApplication.job, payload);

    let application = existingApplication;
    if (shouldPromoteStatus(existingApplication.status, status)) {
      application = await db.jobApplication.update({
        where: { id: existingApplication.id },
        data: { status },
        include: { job: true },
      });
    } else {
      application = await db.jobApplication.findUnique({
        where: { id: existingApplication.id },
        include: { job: true },
      });
    }

    return { application, created: false };
  }

  let listing = existingListing;

  if (!listing) {
    listing = await db.jobListing.create({
      data: payload,
    });
  } else {
    listing = await mergeListingData(listing.id, listing, payload);
  }

  // Check if this user already has an application for this listing
  const existingUserApplication = await db.jobApplication.findFirst({
    where: {
      userId,
      jobId: listing.id
    }
  });

  if (existingUserApplication) {
    return { application: existingUserApplication, created: false };
  }

  const application = await db.jobApplication.create({
    data: {
      userId,
      jobId: listing.id,
      status,
    },
    include: { job: true },
  });

  return { application, created: true };
}
