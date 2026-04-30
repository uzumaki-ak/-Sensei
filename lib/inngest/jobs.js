import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { pusherServer } from "../pusher";
import { runJobHuntForUser } from "../job-hunt";

const NIGHTLY_JOB_HUNT_CRON =
  process.env.NIGHTLY_JOB_HUNT_CRON || "TZ=Asia/Kolkata 0 0 * * *";
const NIGHTLY_MAX_TOTAL_MS = Number(process.env.NIGHTLY_HUNT_MAX_TOTAL_MS || 240000);
const NIGHTLY_QUERY_LIMIT = Number(process.env.NIGHTLY_HUNT_QUERY_LIMIT || 4);
const NIGHTLY_MAX_FALLBACK_PER_QUERY = Number(
  process.env.NIGHTLY_HUNT_MAX_FALLBACK_PER_QUERY || 6
);
const NIGHTLY_TARGET_CREATED_APPLICATIONS = Number(
  process.env.NIGHTLY_HUNT_TARGET_CREATED || 10
);
const NIGHTLY_USE_CRAWLER =
  String(process.env.NIGHTLY_HUNT_USE_CRAWLER || "false").toLowerCase() === "true";

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

    for (const user of users) {
      const userResult = await step.run(`Nightly hunt for ${user.id}`, async () => {
        const huntResult = await runJobHuntForUser(user, {
          status: "Discovered",
          log: (message) => console.error(message),
          maxTotalMs: NIGHTLY_MAX_TOTAL_MS,
          queryLimit: NIGHTLY_QUERY_LIMIT,
          maxFallbackPerQuery: NIGHTLY_MAX_FALLBACK_PER_QUERY,
          targetCreatedApplications: NIGHTLY_TARGET_CREATED_APPLICATIONS,
          useCrawler: NIGHTLY_USE_CRAWLER,
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

    return totals;
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
