"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getModel } from "@/lib/gemini";
import { fetchPageContent } from "@/lib/scraper";

const MAX_MANUAL_LINKS = 8;
const MAX_SITE_SOURCES = 8;
const MAX_NEWS_RESULTS = 14;
const MAX_SNIPPET_LENGTH = 2600;

function normalizeText(value, maxLength = 2000) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function normalizeUrl(url) {
  let value = String(url || "").trim();
  if (!value) return null;
  value = value.replace(/[),.;]+$/g, "");
  if (/^www\./i.test(value)) value = `https://${value}`;
  if (!isHttpUrl(value)) return null;
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function dedupeUrls(urls = []) {
  const out = [];
  const seen = new Set();
  for (const raw of urls) {
    const normalized = normalizeUrl(raw);
    if (!normalized) continue;
    const key = normalized.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function tryParseJson(text) {
  try {
    return JSON.parse(String(text || "").replace(/```json|```/gi, "").trim());
  } catch {
    return null;
  }
}

function decodeXmlEntities(input) {
  return String(input || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseGoogleNewsRss(xmlText, limit = 6) {
  const items = [];
  const itemMatches = String(xmlText || "").match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const rawItem of itemMatches.slice(0, limit)) {
    const title =
      rawItem.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i)?.[1] ||
      rawItem.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ||
      "Untitled";
    const link =
      rawItem.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ||
      rawItem.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ||
      "";
    const time = rawItem.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "Recent";

    items.push({
      title: decodeXmlEntities(title).trim(),
      link: decodeXmlEntities(link).trim(),
      time: decodeXmlEntities(time).trim(),
    });
  }
  return items.filter((item) => item.title && item.link);
}

function hostHintFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host.split(".").slice(0, 2).join(" ");
  } catch {
    return "";
  }
}

function splitManualLinks(rawLinks) {
  if (Array.isArray(rawLinks)) {
    return rawLinks
      .flatMap((item) => String(item || "").split(/[\n,]/))
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_MANUAL_LINKS);
  }
  return String(rawLinks || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_MANUAL_LINKS);
}

async function fetchRecentCompanyNews(companyName, urlHints = []) {
  const queryHints = urlHints
    .map((url) => hostHintFromUrl(url))
    .filter(Boolean)
    .slice(0, 2);

  const queries = [
    companyName,
    `${companyName} ${queryHints[0] || ""}`.trim(),
    `${companyName} founder CEO`,
    `${companyName} layoffs salary hiring culture`,
    `${companyName} lawsuit compliance fraud`,
  ].filter(Boolean);

  const collected = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
        query
      )}&hl=en-US&gl=US&ceid=US:en`;
      const response = await fetch(rssUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      });
      if (!response.ok) continue;

      const xml = await response.text();
      const items = parseGoogleNewsRss(xml, 5);
      for (const item of items) {
        const key = `${item.link}|${item.title}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push({
          ...item,
          query,
          type: "news",
        });
        if (collected.length >= MAX_NEWS_RESULTS) break;
      }
      if (collected.length >= MAX_NEWS_RESULTS) break;
    } catch {
      // Ignore single-query failures and continue.
    }
  }

  return collected.slice(0, MAX_NEWS_RESULTS);
}

function normalizeEvidenceIds(evidenceIds = [], sourceIds = new Set()) {
  if (!Array.isArray(evidenceIds)) return [];
  return evidenceIds
    .map((id) => String(id || "").trim())
    .filter((id) => sourceIds.has(id))
    .slice(0, 6);
}

function normalizeRiskLabel(label) {
  const normalized = String(label || "").toUpperCase().trim();
  if (normalized === "RED" || normalized === "YELLOW" || normalized === "GREEN") {
    return normalized;
  }
  return "YELLOW";
}

export async function generateCompanyIntel(applicationId, options = {}) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    if (!applicationId) {
      throw new Error("A selected job is required.");
    }

    const application = await db.jobApplication.findFirst({
      where: {
        id: applicationId,
        user: {
          clerkUserId: userId,
        },
      },
      include: {
        job: true,
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!application) throw new Error("Job application not found.");

    const companyName = application.job.company;
    if (!companyName) throw new Error("Job does not have a company name specified.");

    const manualLinks = dedupeUrls(splitManualLinks(options?.links));
    const baseLinks = dedupeUrls([application.job.sourceLink, ...manualLinks]).slice(
      0,
      MAX_SITE_SOURCES
    );

    const siteSources = await Promise.all(
      baseLinks.map(async (url) => {
        try {
          const html = await fetchPageContent(url);
          const snippet = normalizeText(html, MAX_SNIPPET_LENGTH);
          return {
            type: "site",
            url,
            title: hostHintFromUrl(url) || url,
            snippet,
          };
        } catch {
          return {
            type: "site",
            url,
            title: hostHintFromUrl(url) || url,
            snippet: "",
          };
        }
      })
    );

    const newsItems = await fetchRecentCompanyNews(companyName, baseLinks);

    const sources = [];
    let sourceCounter = 1;

    for (const source of siteSources) {
      sources.push({
        id: `S${sourceCounter}`,
        type: source.type,
        url: source.url,
        title: source.title,
        text: source.snippet || "",
        meta: "",
      });
      sourceCounter += 1;
    }

    for (const news of newsItems) {
      sources.push({
        id: `S${sourceCounter}`,
        type: "news",
        url: news.link,
        title: news.title,
        text: normalizeText(`${news.title}. ${news.query}`, 260),
        meta: news.time,
      });
      sourceCounter += 1;
    }

    const prompt = `
You are a strict company-intel analyst helping a candidate prepare for interviews.
Goal: disambiguate company identity, produce OSINT-style low-level risk screening, and interview-ready guidance.

Target:
- Company name from job: ${companyName}
- Job role: ${application.job.title}
- Job description excerpt: ${normalizeText(application.job.description, 1200)}
- Job stack: ${(application.job.techStack || []).join(", ") || "Not specified"}

Manual company links provided by user:
${manualLinks.length ? manualLinks.join("\n") : "None"}

Sources (you MUST use only these):
${sources
  .map(
    (source) =>
      `${source.id} | ${source.type} | ${source.url}\nTitle: ${source.title}\nMeta: ${
        source.meta || "N/A"
      }\nText: ${source.text || "N/A"}`
  )
  .join("\n\n")}

Return strict JSON only:
{
  "entityMatch": {
    "matchedCompany": "string",
    "confidence": "high | medium | low",
    "reasoning": "string",
    "ambiguityWarning": "string"
  },
  "riskSummary": {
    "overallLabel": "GREEN | YELLOW | RED",
    "greenCount": 0,
    "yellowCount": 0,
    "redCount": 0,
    "note": "string"
  },
  "bento": {
    "businessContext": {
      "summary": "string",
      "evidenceIds": ["S1"]
    },
    "leadershipAndGovernance": {
      "summary": "string",
      "evidenceIds": ["S2"]
    },
    "hiringAndPeopleSignals": {
      "summary": "string",
      "evidenceIds": ["S3"]
    },
    "riskAlerts": [
      {
        "label": "GREEN | YELLOW | RED",
        "topic": "string",
        "finding": "string",
        "evidenceIds": ["S4"],
        "confidence": "high | medium | low"
      }
    ],
    "interviewAngles": ["string"],
    "askBackQuestions": ["string"]
  }
}

Rules:
- Never invent facts.
- Every non-trivial claim must map to evidenceIds.
- If data is insufficient, explicitly say so and set confidence to low/medium.
- If company appears ambiguous (same-name entities), explain ambiguityWarning and prefer caution.
- Risk alerts can include governance, legal, compliance, layoffs, compensation, PR, product reliability, or culture signals from sources.
`;

    const model = getModel();
    const result = await model.generateContent(prompt);
    const parsed = tryParseJson(result.response.text());

    const sourceIds = new Set(sources.map((source) => source.id));

    const fallbackIntel = {
      entityMatch: {
        matchedCompany: companyName,
        confidence: "low",
        reasoning:
          "Source coverage is limited. The result may include same-name company ambiguity.",
        ambiguityWarning:
          "Please add official company website/LinkedIn links to improve entity match confidence.",
      },
      riskSummary: {
        overallLabel: "YELLOW",
        greenCount: 0,
        yellowCount: 1,
        redCount: 0,
        note: "Insufficient verified data for strong risk grading.",
      },
      bento: {
        businessContext: {
          summary:
            "Basic company/job context is available, but external verification depth is limited.",
          evidenceIds: sources.slice(0, 2).map((source) => source.id),
        },
        leadershipAndGovernance: {
          summary: "No high-confidence leadership/governance conclusions from current sources.",
          evidenceIds: [],
        },
        hiringAndPeopleSignals: {
          summary: "No high-confidence hiring/culture conclusions from current sources.",
          evidenceIds: [],
        },
        riskAlerts: [
          {
            label: "YELLOW",
            topic: "Entity ambiguity risk",
            finding:
              "Same-name company overlap is possible. Add official links to avoid wrong-company intelligence.",
            evidenceIds: sources.slice(0, 2).map((source) => source.id),
            confidence: "medium",
          },
        ],
        interviewAngles: [
          "Ask interviewer to confirm company product lines and current team priorities.",
          "Validate recent company milestones directly during interview discussion.",
        ],
        askBackQuestions: [
          "What are the top business goals this role supports in the next two quarters?",
          "Which engineering/product risks are most critical for this team right now?",
        ],
      },
    };

    const intel = parsed && typeof parsed === "object" ? parsed : fallbackIntel;

    const normalizedIntel = {
      entityMatch: {
        matchedCompany: normalizeText(
          intel?.entityMatch?.matchedCompany || fallbackIntel.entityMatch.matchedCompany,
          140
        ),
        confidence: ["high", "medium", "low"].includes(
          String(intel?.entityMatch?.confidence || "").toLowerCase()
        )
          ? String(intel.entityMatch.confidence).toLowerCase()
          : "low",
        reasoning: normalizeText(
          intel?.entityMatch?.reasoning || fallbackIntel.entityMatch.reasoning,
          420
        ),
        ambiguityWarning: normalizeText(
          intel?.entityMatch?.ambiguityWarning || fallbackIntel.entityMatch.ambiguityWarning,
          320
        ),
      },
      riskSummary: {
        overallLabel: normalizeRiskLabel(intel?.riskSummary?.overallLabel),
        greenCount: Math.max(0, Number(intel?.riskSummary?.greenCount) || 0),
        yellowCount: Math.max(0, Number(intel?.riskSummary?.yellowCount) || 0),
        redCount: Math.max(0, Number(intel?.riskSummary?.redCount) || 0),
        note: normalizeText(intel?.riskSummary?.note || fallbackIntel.riskSummary.note, 320),
      },
      bento: {
        businessContext: {
          summary: normalizeText(
            intel?.bento?.businessContext?.summary ||
              fallbackIntel.bento.businessContext.summary,
            520
          ),
          evidenceIds: normalizeEvidenceIds(
            intel?.bento?.businessContext?.evidenceIds,
            sourceIds
          ),
        },
        leadershipAndGovernance: {
          summary: normalizeText(
            intel?.bento?.leadershipAndGovernance?.summary ||
              fallbackIntel.bento.leadershipAndGovernance.summary,
            520
          ),
          evidenceIds: normalizeEvidenceIds(
            intel?.bento?.leadershipAndGovernance?.evidenceIds,
            sourceIds
          ),
        },
        hiringAndPeopleSignals: {
          summary: normalizeText(
            intel?.bento?.hiringAndPeopleSignals?.summary ||
              fallbackIntel.bento.hiringAndPeopleSignals.summary,
            520
          ),
          evidenceIds: normalizeEvidenceIds(
            intel?.bento?.hiringAndPeopleSignals?.evidenceIds,
            sourceIds
          ),
        },
        riskAlerts: Array.isArray(intel?.bento?.riskAlerts)
          ? intel.bento.riskAlerts
              .map((item) => ({
                label: normalizeRiskLabel(item?.label),
                topic: normalizeText(item?.topic, 120),
                finding: normalizeText(item?.finding, 260),
                evidenceIds: normalizeEvidenceIds(item?.evidenceIds, sourceIds),
                confidence: ["high", "medium", "low"].includes(
                  String(item?.confidence || "").toLowerCase()
                )
                  ? String(item.confidence).toLowerCase()
                  : "medium",
              }))
              .filter((item) => item.topic && item.finding)
              .slice(0, 8)
          : fallbackIntel.bento.riskAlerts,
        interviewAngles: Array.isArray(intel?.bento?.interviewAngles)
          ? intel.bento.interviewAngles
              .map((item) => normalizeText(item, 180))
              .filter(Boolean)
              .slice(0, 8)
          : fallbackIntel.bento.interviewAngles,
        askBackQuestions: Array.isArray(intel?.bento?.askBackQuestions)
          ? intel.bento.askBackQuestions
              .map((item) => normalizeText(item, 180))
              .filter(Boolean)
              .slice(0, 8)
          : fallbackIntel.bento.askBackQuestions,
      },
      sourceRefs: sources.map((source) => ({
        id: source.id,
        type: source.type,
        title: normalizeText(source.title, 140),
        url: source.url,
        meta: normalizeText(source.meta, 100),
      })),
    };

    const talkingPointsMarkdown = `## Interview Intel Summary
**Entity match confidence:** ${normalizedIntel.entityMatch.confidence.toUpperCase()}

### Business Context
${normalizedIntel.bento.businessContext.summary}

### Leadership & Governance
${normalizedIntel.bento.leadershipAndGovernance.summary}

### Hiring & People Signals
${normalizedIntel.bento.hiringAndPeopleSignals.summary}

### Interview Angles
${normalizedIntel.bento.interviewAngles.map((item) => `- ${item}`).join("\n")}
`;

    const savedHistory = await db.companyIntelHistory.create({
      data: {
        userId: application.user.id,
        applicationId: application.id,
        manualLinks,
        intel: normalizedIntel,
        talkingPointsMarkdown,
        recentNews: newsItems,
      },
    });

    return {
      success: true,
      intel: normalizedIntel,
      talkingPointsMarkdown,
      recentNews: newsItems,
      manualLinks,
      historyItem: {
        id: savedHistory.id,
        createdAt: savedHistory.createdAt,
        applicationId: application.id,
        jobLabel: `${application.job.company} - ${application.job.title}`,
        intel: normalizedIntel,
        talkingPointsMarkdown,
        recentNews: newsItems,
        manualLinks,
      },
    };
  } catch (error) {
    console.error("[Company Intel Error]:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred during analysis.",
    };
  }
}

export async function getCompanyIntelHistory(applicationId = null) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });
    if (!user) throw new Error("User not found");

    const history = await db.companyIntelHistory.findMany({
      where: {
        userId: user.id,
        ...(applicationId ? { applicationId } : {}),
      },
      include: {
        application: {
          select: {
            job: {
              select: {
                company: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return {
      success: true,
      history: history.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        applicationId: item.applicationId,
        manualLinks: item.manualLinks,
        intel: item.intel,
        talkingPointsMarkdown: item.talkingPointsMarkdown,
        recentNews: item.recentNews,
        jobLabel: `${item.application?.job?.company || "Unknown"} - ${
          item.application?.job?.title || "Role"
        }`,
      })),
    };
  } catch (error) {
    console.error("[Company Intel History Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch company intel history.",
    };
  }
}
