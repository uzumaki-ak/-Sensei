"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

const DEFAULT_RETENTION_DAYS = Math.min(
  30,
  Math.max(1, Number(process.env.EVENT_TIMELINE_RETENTION_DAYS) || 2)
);

function resolveRetentionDays(override) {
  const candidate = Number(override);
  if (Number.isFinite(candidate) && candidate >= 1) {
    return Math.min(30, Math.floor(candidate));
  }
  return DEFAULT_RETENTION_DAYS;
}

function buildCutoffDate(retentionDays) {
  return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
}

function hasPersonalChatSessionModel() {
  return Boolean(db.personalChatSession && typeof db.personalChatSession.findMany === "function");
}

function whereByUser(userField, userId, cutoffDate) {
  return {
    [userField]: userId,
    createdAt: {
      gte: cutoffDate,
    },
  };
}

async function getCurrentUserId() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");
  return user.id;
}

export async function getEventTimeline(limit = 80, retentionDaysOverride = null) {
  try {
    const internalUserId = await getCurrentUserId();
    const take = Math.min(200, Math.max(20, Number(limit) || 80));
    const retentionDays = resolveRetentionDays(retentionDaysOverride);
    const cutoffDate = buildCutoffDate(retentionDays);
    const personalChatSessionAvailable = hasPersonalChatSessionModel();

    const [
      reverseRecruiter,
      github,
      companyIntel,
      drip,
      offer,
      meet,
      rag,
      multiAgent,
      promptEval,
      personalChats,
    ] = await Promise.all([
      db.reverseRecruiterHistory.findMany({
        where: whereByUser("userId", internalUserId, cutoffDate),
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.githubAnalysisHistory.findMany({
        where: whereByUser("userId", internalUserId, cutoffDate),
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.companyIntelHistory.findMany({
        where: whereByUser("userId", internalUserId, cutoffDate),
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.dripCampaignHistory.findMany({
        where: whereByUser("userId", internalUserId, cutoffDate),
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.offerCopilotHistory.findMany({
        where: whereByUser("userId", internalUserId, cutoffDate),
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.interviewMeetRoom.findMany({
        where: whereByUser("ownerUserId", internalUserId, cutoffDate),
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.ragQueryHistory.findMany({
        where: whereByUser("userId", internalUserId, cutoffDate),
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.multiAgentRun.findMany({
        where: whereByUser("userId", internalUserId, cutoffDate),
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.promptEvalRun.findMany({
        where: whereByUser("userId", internalUserId, cutoffDate),
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      personalChatSessionAvailable
        ? db.personalChatSession.findMany({
            where: {
              userId: internalUserId,
              createdAt: { gte: cutoffDate },
            },
            include: {
              application: { include: { job: true } },
              messages: {
                where: { role: "assistant" },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
            orderBy: { updatedAt: "desc" },
            take,
          })
        : Promise.resolve([]),
    ]);

    const events = [
      ...reverseRecruiter.map((item) => ({
        id: `rr-${item.id}`,
        type: "reverse-recruiter",
        title: `Reverse Recruiter Draft -> ${item.targetName}`,
        subtitle: `${item.application?.job?.company || "Unknown"} - ${
          item.application?.job?.title || "Role"
        }`,
        createdAt: item.createdAt,
        href: "/advanced/reverse-recruiter",
      })),
      ...github.map((item) => ({
        id: `gh-${item.id}`,
        type: "github-analyzer",
        title: `GitHub Gap Analysis`,
        subtitle: `${item.application?.job?.company || "Unknown"} - ${
          item.application?.job?.title || "Role"
        }`,
        createdAt: item.createdAt,
        href: "/advanced/github-analyzer",
      })),
      ...companyIntel.map((item) => ({
        id: `ci-${item.id}`,
        type: "company-intel",
        title: "Company Intel Run",
        subtitle: `${item.application?.job?.company || "Unknown"} - ${
          item.application?.job?.title || "Role"
        }`,
        createdAt: item.createdAt,
        href: "/advanced/company-intel",
      })),
      ...drip.map((item) => ({
        id: `dr-${item.id}`,
        type: "drip-campaign",
        title: "Cold Email Drip Generated",
        subtitle: `${item.application?.job?.company || "Unknown"} - ${
          item.application?.job?.title || "Role"
        }`,
        createdAt: item.createdAt,
        href: "/advanced/drip-campaigns",
      })),
      ...offer.map((item) => ({
        id: `of-${item.id}`,
        type: "offer-copilot",
        title: "Offer Copilot Playbook",
        subtitle: `${item.application?.job?.company || "Unknown"} - ${
          item.application?.job?.title || "Role"
        }`,
        createdAt: item.createdAt,
        href: "/advanced/offer-copilot",
      })),
      ...meet.map((item) => ({
        id: `mt-${item.id}`,
        type: "interview-meet",
        title: `Interview Room ${item.code} (${item.status})`,
        subtitle: `${item.application?.job?.company || "Unknown"} - ${
          item.application?.job?.title || "Role"
        }`,
        createdAt: item.createdAt,
        href: `/meet/${item.code}`,
      })),
      ...rag.map((item) => ({
        id: `rag-${item.id}`,
        type: "rag-copilot",
        title: "RAG Copilot Q/A",
        subtitle: item.question.slice(0, 100),
        createdAt: item.createdAt,
        href: "/advanced/rag-copilot",
      })),
      ...multiAgent.map((item) => ({
        id: `ma-${item.id}`,
        type: "multi-agent-studio",
        title: "Multi-Agent Studio Run",
        subtitle: item.goal.slice(0, 100),
        createdAt: item.createdAt,
        href: "/advanced/multi-agent-studio",
      })),
      ...promptEval.map((item) => ({
        id: `pe-${item.id}`,
        type: "prompt-eval-lab",
        title: "Prompt Eval Run",
        subtitle: item.task.slice(0, 100),
        createdAt: item.createdAt,
        href: "/advanced/prompt-eval-lab",
      })),
      ...personalChats.map((item) => ({
        id: `pc-${item.id}`,
        type: "personal-chatbot",
        title: "Personal Chat Session",
        subtitle: item.messages?.[0]?.content?.slice(0, 100) || item.title || "Personal copilot reply",
        createdAt: item.updatedAt,
        href: "/advanced/personal-chatbot",
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, take);

    return {
      success: true,
      events,
      meta: {
        retentionDays,
        cutoffAt: cutoffDate,
        personalChatSessionAvailable,
      },
    };
  } catch (error) {
    console.error("[Event Timeline Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to load event timeline.",
    };
  }
}

export async function purgeOldTimelineData(retentionDaysOverride = null) {
  try {
    const internalUserId = await getCurrentUserId();
    const retentionDays = resolveRetentionDays(retentionDaysOverride);
    const cutoffDate = buildCutoffDate(retentionDays);
    const personalChatSessionAvailable = hasPersonalChatSessionModel();

    const [
      reverseRecruiterDeleted,
      githubDeleted,
      companyIntelDeleted,
      dripDeleted,
      offerDeleted,
      meetDeleted,
      ragDeleted,
      multiAgentDeleted,
      promptEvalDeleted,
      personalChatDeleted,
    ] = await Promise.all([
      db.reverseRecruiterHistory.deleteMany({
        where: { userId: internalUserId, createdAt: { lt: cutoffDate } },
      }),
      db.githubAnalysisHistory.deleteMany({
        where: { userId: internalUserId, createdAt: { lt: cutoffDate } },
      }),
      db.companyIntelHistory.deleteMany({
        where: { userId: internalUserId, createdAt: { lt: cutoffDate } },
      }),
      db.dripCampaignHistory.deleteMany({
        where: { userId: internalUserId, createdAt: { lt: cutoffDate } },
      }),
      db.offerCopilotHistory.deleteMany({
        where: { userId: internalUserId, createdAt: { lt: cutoffDate } },
      }),
      db.interviewMeetRoom.deleteMany({
        where: { ownerUserId: internalUserId, createdAt: { lt: cutoffDate } },
      }),
      db.ragQueryHistory.deleteMany({
        where: { userId: internalUserId, createdAt: { lt: cutoffDate } },
      }),
      db.multiAgentRun.deleteMany({
        where: { userId: internalUserId, createdAt: { lt: cutoffDate } },
      }),
      db.promptEvalRun.deleteMany({
        where: { userId: internalUserId, createdAt: { lt: cutoffDate } },
      }),
      personalChatSessionAvailable
        ? db.personalChatSession.deleteMany({
            where: { userId: internalUserId, createdAt: { lt: cutoffDate } },
          })
        : Promise.resolve({ count: 0 }),
    ]);

    const deleted = {
      reverseRecruiter: reverseRecruiterDeleted.count || 0,
      github: githubDeleted.count || 0,
      companyIntel: companyIntelDeleted.count || 0,
      drip: dripDeleted.count || 0,
      offer: offerDeleted.count || 0,
      meet: meetDeleted.count || 0,
      rag: ragDeleted.count || 0,
      multiAgent: multiAgentDeleted.count || 0,
      promptEval: promptEvalDeleted.count || 0,
      personalChat: personalChatDeleted.count || 0,
    };

    return {
      success: true,
      retentionDays,
      cutoffAt: cutoffDate,
      personalChatSessionAvailable,
      deleted,
      totalDeleted: Object.values(deleted).reduce((sum, value) => sum + value, 0),
    };
  } catch (error) {
    console.error("[Event Timeline Purge Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to purge old timeline events.",
    };
  }
}
