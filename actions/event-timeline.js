"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

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

export async function getEventTimeline(limit = 80) {
  try {
    const internalUserId = await getCurrentUserId();
    const take = Math.min(200, Math.max(20, Number(limit) || 80));

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
        where: { userId: internalUserId },
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.githubAnalysisHistory.findMany({
        where: { userId: internalUserId },
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.companyIntelHistory.findMany({
        where: { userId: internalUserId },
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.dripCampaignHistory.findMany({
        where: { userId: internalUserId },
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.offerCopilotHistory.findMany({
        where: { userId: internalUserId },
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.interviewMeetRoom.findMany({
        where: { ownerUserId: internalUserId },
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.ragQueryHistory.findMany({
        where: { userId: internalUserId },
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.multiAgentRun.findMany({
        where: { userId: internalUserId },
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.promptEvalRun.findMany({
        where: { userId: internalUserId },
        include: { application: { include: { job: true } } },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.personalChatSession.findMany({
        where: { userId: internalUserId },
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
      }),
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
    };
  } catch (error) {
    console.error("[Event Timeline Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to load event timeline.",
    };
  }
}
