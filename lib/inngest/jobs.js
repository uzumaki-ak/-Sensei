import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { pusherServer } from "../pusher";
import { runJobHuntForUser } from "../job-hunt";

const NIGHTLY_JOB_HUNT_CRON =
  process.env.NIGHTLY_JOB_HUNT_CRON || "TZ=Asia/Kolkata 0 0 * * *";
const NIGHTLY_MAX_TOTAL_MS = Number(process.env.NIGHTLY_HUNT_MAX_TOTAL_MS || 180000);
const NIGHTLY_QUERY_LIMIT = Number(process.env.NIGHTLY_HUNT_QUERY_LIMIT || 4);
const NIGHTLY_MAX_FALLBACK_PER_QUERY = Number(
  process.env.NIGHTLY_HUNT_MAX_FALLBACK_PER_QUERY || 6
);
const NIGHTLY_TARGET_CREATED_APPLICATIONS = Number(
  process.env.NIGHTLY_HUNT_TARGET_CREATED || 10
);
const NIGHTLY_USE_CRAWLER =
  String(process.env.NIGHTLY_HUNT_USE_CRAWLER || "true").toLowerCase() === "true";
const NIGHTLY_CRAWLER_WARMUP_ENABLED =
  String(process.env.NIGHTLY_HUNT_CRAWLER_WARMUP_ENABLED || "true").toLowerCase() === "true";
const NIGHTLY_CRAWLER_WARMUP_ATTEMPTS = Number(
  process.env.NIGHTLY_HUNT_CRAWLER_WARMUP_ATTEMPTS || 1
);
const NIGHTLY_CRAWLER_WARMUP_TIMEOUT_MS = Number(
  process.env.NIGHTLY_HUNT_CRAWLER_WARMUP_TIMEOUT_MS || 80000
);
const NIGHTLY_CRAWLER_WARMUP_WAIT_SECONDS = Number(
  process.env.NIGHTLY_HUNT_CRAWLER_WARMUP_WAIT_SECONDS || 20
);
const CRAWLER_BASE_URL = process.env.HUNT_CRAWLER_URL?.trim();

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function buildCrawlerHealthUrl() {
  if (!CRAWLER_BASE_URL) return null;
  const base = CRAWLER_BASE_URL.endsWith("/")
    ? CRAWLER_BASE_URL.slice(0, -1)
    : CRAWLER_BASE_URL;
  return `${base}/health`;
}

async function pingCrawlerHealth(url, timeoutMs) {
  if (!url) {
    return { ok: false, reason: "crawler-url-missing" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: `health-http-${response.status}` };
    }

    const payload = await response.json().catch(() => ({}));
    if (payload && payload.ok === false) {
      return { ok: false, reason: "health-not-ok" };
    }

    return { ok: true, reason: "healthy" };
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    return {
      ok: false,
      reason: isAbort ? "health-timeout" : `health-error:${error?.message || "unknown"}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function sendTelegramSniperAlert(chatId, createdApplications, applications = []) {
  if (!chatId || createdApplications <= 0) return;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const topJobs = Array.isArray(applications)
    ? applications
        .slice(0, 3)
        .map((app, idx) => {
          const title = app?.job?.title || "Job opportunity";
          const company = app?.job?.company || "Unknown company";
          const link = app?.job?.sourceLink;
          return link
            ? `${idx + 1}. ${title} @ ${company}\n${link}`
            : `${idx + 1}. ${title} @ ${company}`;
        })
    : [];

  const text = [
    "Sniper Alert",
    "",
    `Found ${createdApplications} new matching job(s).`,
    topJobs.length ? "" : "Open your Kanban board to review and apply.",
    ...topJobs,
    "",
    "Open Kanban in app to shortlist/apply.",
  ].join("\n");

  try {
    await fetch(telegramApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });
  } catch (error) {
    console.error("[TelegramSniper] Failed to send alert:", error?.message || error);
  }
}

/**
 * Automated Nightly Job Hunt
 */
export const nightlyJobHunt = inngest.createFunction(
  { id: "nightly-job-hunt", name: "Nightly Job Hunt", retries: 1 },
  { cron: NIGHTLY_JOB_HUNT_CRON },
  async ({ step }) => {
    const users = await step.run("Fetch active users", async () => {
      return db.user.findMany({
        where: { NOT: { industry: null } },
        select: { id: true, industry: true, skills: true, personas: true, telegramChatId: true },
      });
    });

    const totals = {
      users: users.length,
      discoveredUrls: 0,
      createdApplications: 0,
      refreshedApplications: 0,
      failedUrls: 0,
      fallbackJobsFetched: 0,
    };

    let useCrawlerForRun = NIGHTLY_USE_CRAWLER;
    const crawlerWarmup = {
      enabled: NIGHTLY_USE_CRAWLER,
      attempted: false,
      ok: !NIGHTLY_USE_CRAWLER,
      attempts: 0,
      reason: NIGHTLY_USE_CRAWLER ? null : "crawler-disabled",
    };

    if (NIGHTLY_USE_CRAWLER) {
      const healthUrl = buildCrawlerHealthUrl();
      const maxAttempts = toPositiveInt(NIGHTLY_CRAWLER_WARMUP_ATTEMPTS, 1);
      const timeoutMs = toPositiveInt(NIGHTLY_CRAWLER_WARMUP_TIMEOUT_MS, 80000);
      const waitSeconds = toPositiveInt(NIGHTLY_CRAWLER_WARMUP_WAIT_SECONDS, 20);

      if (!healthUrl) {
        useCrawlerForRun = false;
        crawlerWarmup.reason = "crawler-url-missing";
      } else if (!NIGHTLY_CRAWLER_WARMUP_ENABLED) {
        crawlerWarmup.ok = true;
        crawlerWarmup.reason = "warmup-skipped";
      } else {
        crawlerWarmup.attempted = true;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const ping = await step.run(`Warm crawler ping ${attempt}`, async () => {
            return pingCrawlerHealth(healthUrl, timeoutMs);
          });

          crawlerWarmup.attempts = attempt;
          crawlerWarmup.ok = Boolean(ping?.ok);
          crawlerWarmup.reason = ping?.reason || null;

          if (crawlerWarmup.ok) break;
          if (attempt < maxAttempts) {
            await step.sleep(`Warm crawler wait ${attempt}`, `${waitSeconds}s`);
          }
        }

        if (!crawlerWarmup.ok) {
          useCrawlerForRun = false;
        }
      }
    }

    for (const user of users) {
      const userResult = await step.run(`Nightly hunt for ${user.id}`, async () => {
        const huntResult = await runJobHuntForUser(user, {
          status: "Discovered",
          log: (message) => console.error(message),
          maxTotalMs: NIGHTLY_MAX_TOTAL_MS,
          queryLimit: NIGHTLY_QUERY_LIMIT,
          maxFallbackPerQuery: NIGHTLY_MAX_FALLBACK_PER_QUERY,
          targetCreatedApplications: NIGHTLY_TARGET_CREATED_APPLICATIONS,
          useCrawler: useCrawlerForRun,
          useFallback: true,
        });

        for (const application of huntResult.newApplications) {
          try {
            await pusherServer.trigger(`user-${user.id}`, "job-discovered", application);
          } catch (pusherError) {
            console.error("[NightlyJobHunt] Pusher broadcast failed:", pusherError.message);
          }
        }

        await sendTelegramSniperAlert(
          user.telegramChatId,
          huntResult.totals.createdApplications || 0,
          huntResult.newApplications || []
        );

        return {
          userId: user.id,
          totals: huntResult.totals,
        };
      });

      const perUserTotals = userResult?.totals || {};
      totals.discoveredUrls += Number(perUserTotals.discoveredUrls || 0);
      totals.createdApplications += Number(perUserTotals.createdApplications || 0);
      totals.refreshedApplications += Number(perUserTotals.refreshedApplications || 0);
      totals.failedUrls += Number(perUserTotals.failedUrls || 0);
      totals.fallbackJobsFetched += Number(perUserTotals.fallbackJobsFetched || 0);
    }

    return {
      ...totals,
      crawlerWarmup,
      useCrawlerForRun,
    };
  }
);

/**
 * Manual Job Hunt Trigger (for testing or immediate runs)
 */
export const manualJobHunt = inngest.createFunction(
  { id: "manual-job-hunt", name: "Manual Job Hunt" },
  { event: "jobs/manual-hunt" },
  async ({ event, step }) => {
    const { userId, industry, skills, personas } = event.data;

    console.log(`[ManualJobHunt] Running for user: ${userId}`);

    const huntResult = await step.run("Run hunt", async () => {
      return await runJobHuntForUser(
        { id: userId, industry, skills: skills || [], personas: personas || [] },
        {
          status: "Discovered",
          log: (message) => console.log(`[ManualJobHunt] ${message}`),
        }
      );
    });

    // Broadcast new jobs via Pusher
    await step.run("Broadcast new jobs", async () => {
      for (const application of huntResult.newApplications) {
        try {
          await pusherServer.trigger(`user-${userId}`, "job-discovered", application);
        } catch (pusherError) {
          console.error("[ManualJobHunt] Pusher broadcast failed:", pusherError.message);
        }
      }
    });

    return {
      success: true,
      totals: huntResult.totals,
      queries: huntResult.queries,
    };
  }
);
