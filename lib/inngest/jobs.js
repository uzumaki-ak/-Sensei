import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { pusherServer } from "../pusher";
import { runJobHuntForUser } from "../job-hunt";

/**
 * Automated Nightly Job Hunt
 */
export const nightlyJobHunt = inngest.createFunction(
  { id: "nightly-job-hunt", name: "Nightly Job Hunt" },
  { cron: "0 0 * * *" },
  async ({ step }) => {
    const users = await step.run("Fetch active users", async () => {
      return db.user.findMany({
        where: { NOT: { industry: null } },
        select: { id: true, industry: true, skills: true, personas: true },
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
      await step.run(`Nightly hunt for ${user.id}`, async () => {
        const huntResult = await runJobHuntForUser(user, {
          status: "Discovered",
          log: (message) => console.error(message),
        });

        totals.discoveredUrls += huntResult.totals.discoveredUrls;
        totals.createdApplications += huntResult.totals.createdApplications;
        totals.refreshedApplications += huntResult.totals.refreshedApplications;
        totals.failedUrls += huntResult.totals.failedUrls;
        totals.fallbackJobsFetched += huntResult.totals.fallbackJobsFetched;

        for (const application of huntResult.newApplications) {
          try {
            await pusherServer.trigger(`user-${user.id}`, "job-discovered", application);
          } catch (pusherError) {
            console.error("[NightlyJobHunt] Pusher broadcast failed:", pusherError.message);
          }
        }
      });
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
